/**
 * Match Statistics Function
 * Purpose: Fetches live match statistics and event timelines via API-Football.
 * HTTP Method: GET
 * Inputs:
 *   - home: Name of the home team.
 *   - away: Name of the away team.
 *   - date: ISO date string of the match.
 * Outputs: JSON object with detailed match stats (possession, shots, etc.) and events.
 * External APIs: API-Football (v3.football.api-sports.io)
 */

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const AF = "https://v3.football.api-sports.io";
const cache = new Map<string, { at: number; body: unknown }>();

/** Normalizes team names for fuzzy matching */
function norm(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

/** Tokenizes a string for scoring overlaps */
function tokens(s: string) {
  return new Set(
    norm(s)
      .split(/\s+/)
      .filter((t) => t.length > 2),
  );
}

/** Scores the similarity between two team names */
function score(a: string, b: string) {
  const ta = tokens(a),
    tb = tokens(b);
  let hit = 0;
  for (const t of ta) if (tb.has(t)) hit++;
  return hit;
}

/** Standardized fetcher for API-Football */
async function afFetch(path: string, params: Record<string, string>, key: string) {
  const qs = new URLSearchParams(params).toString();
  const r = await fetch(`${AF}${path}?${qs}`, {
    headers: { "x-apisports-key": key, Accept: "application/json" },
  });
  if (!r.ok) return null;
  return await r.json().catch(() => null);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const apiKey = Deno.env.get("API_FOOTBALL_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "API_FOOTBALL_KEY missing" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const home = url.searchParams.get("home") ?? "";
  const away = url.searchParams.get("away") ?? "";
  const dateParam = url.searchParams.get("date") ?? "";
  if (!home || !away) {
    return new Response(JSON.stringify({ error: "home and away required" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const cacheKey = `${home}|${away}|${dateParam}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < 30_000) {
    return new Response(JSON.stringify(hit.body), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const targetTs = dateParam ? new Date(dateParam).getTime() : Date.now();
    const dates = new Set<string>();
    for (const offset of [-1, 0, 1]) {
      const d = new Date(targetTs + offset * 86400_000);
      dates.add(d.toISOString().slice(0, 10));
    }

    // Pull fixtures for each date window
    let candidates: any[] = [];
    for (const d of dates) {
      const j = await afFetch("/fixtures", { date: d }, apiKey);
      if (j?.response) candidates = candidates.concat(j.response);
    }

    // Also try live for currently in-play matches
    const live = await afFetch("/fixtures", { live: "all" }, apiKey);
    if (live?.response) candidates = candidates.concat(live.response);

    // Score matches by team-name overlap
    let best: any = null;
    let bestScore = 0;
    for (const f of candidates) {
      const h = f.teams?.home?.name ?? "";
      const a = f.teams?.away?.name ?? "";
      const s = score(home, h) + score(away, a);
      const timeDiff = Math.abs(new Date(f.fixture?.date ?? 0).getTime() - targetTs);
      const withinDay = timeDiff < 36 * 3600_000;
      if (s > bestScore && withinDay) {
        bestScore = s;
        best = f;
      }
    }

    if (!best || bestScore < 1) {
      const body = { available: false, reason: "no matching fixture", stats: [], status: null };
      cache.set(cacheKey, { at: Date.now(), body });
      return new Response(JSON.stringify(body), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const fixtureId = best.fixture.id;
    const [statsJ, eventsJ, lineupsJ] = await Promise.all([
      afFetch("/fixtures/statistics", { fixture: String(fixtureId) }, apiKey),
      afFetch("/fixtures/events", { fixture: String(fixtureId) }, apiKey),
      afFetch("/fixtures/lineups", { fixture: String(fixtureId) }, apiKey),
    ]);

    // Map AF stats into { name, home, away }
    const statsArr: any[] = statsJ?.response ?? [];
    const homeTeamId = best.teams.home.id;
    const awayTeamId = best.teams.away.id;
    const homeStats = statsArr.find((s) => s.team?.id === homeTeamId)?.statistics ?? [];
    const awayStats = statsArr.find((s) => s.team?.id === awayTeamId)?.statistics ?? [];
    const statNames = new Set<string>([
      ...homeStats.map((s: any) => s.type),
      ...awayStats.map((s: any) => s.type),
    ]);
    const stats = Array.from(statNames).map((name) => ({
      name,
      home: homeStats.find((s: any) => s.type === name)?.value ?? null,
      away: awayStats.find((s: any) => s.type === name)?.value ?? null,
    }));

    const events = (eventsJ?.response ?? []).map((e: any) => ({
      minute: e.time?.elapsed ?? null,
      extra: e.time?.extra ?? null,
      type: e.type,
      detail: e.detail,
      team: e.team?.name,
      team_id: e.team?.id,
      player: e.player?.name,
      assist: e.assist?.name ?? null,
    }));

    // Lineups: formation, coach, starting XI and bench — with real player
    // headshots served from API-Football's licensed media CDN.
    const playerPhoto = (id: number | null | undefined) =>
      id ? `https://media.api-sports.io/football/players/${id}.png` : null;
    const mapPlayer = (p: any) => ({
      id: p.player?.id ?? null,
      name: p.player?.name ?? "",
      number: p.player?.number ?? null,
      pos: p.player?.pos ?? null,
      grid: p.player?.grid ?? null,
      photo: playerPhoto(p.player?.id),
    });
    const lineups = (lineupsJ?.response ?? []).map((l: any) => ({
      team_id: l.team?.id ?? null,
      team: l.team?.name ?? "",
      formation: l.formation ?? null,
      coach: l.coach?.name ?? null,
      coach_photo: l.coach?.photo ?? null,
      startXI: (l.startXI ?? []).map(mapPlayer),
      substitutes: (l.substitutes ?? []).map(mapPlayer),
    }));

    const status = best.fixture.status;
    const body = {
      available: stats.length > 0 || lineups.length > 0,
      source: "api-football",
      fixture_id: fixtureId,
      status: status?.long ?? null,
      status_short: status?.short ?? null,
      minute: status?.elapsed ?? null,
      home_score: best.goals?.home ?? null,
      away_score: best.goals?.away ?? null,
      home_name: best.teams?.home?.name,
      away_name: best.teams?.away?.name,
      venue: best.fixture?.venue?.name ?? null,
      league: best.league?.name ?? null,
      stats,
      events,
      lineups,
    };
    cache.set(cacheKey, { at: Date.now(), body });
    return new Response(JSON.stringify(body), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ available: false, error: String(e), stats: [] }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
