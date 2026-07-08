// Returns today's live/recent matches across all competitions your football-data.org
// tier has access to (Nations League, Champions League, top domestic leagues, etc.).
// Public endpoint — read-only pass-through with a small in-memory cache.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const FD = "https://api.football-data.org/v4";
let cache: { at: number; body: unknown } | null = null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const token = Deno.env.get("FOOTBALL_DATA_API_TOKEN");
  if (!token) {
    return new Response(JSON.stringify({ error: "FOOTBALL_DATA_API_TOKEN missing" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // 30s cache — free tier allows 10 requests/min
  if (cache && Date.now() - cache.at < 30_000) {
    return new Response(JSON.stringify(cache.body), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "LIVE,IN_PLAY,PAUSED,FINISHED,SCHEDULED,TIMED";
  const today = new Date().toISOString().slice(0, 10);
  const dateTo = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);

  const res = await fetch(
    `${FD}/matches?dateFrom=${today}&dateTo=${dateTo}&status=${encodeURIComponent(status)}`,
    { headers: { "X-Auth-Token": token } },
  );

  if (!res.ok) {
    const detail = await res.text();
    return new Response(JSON.stringify({ error: `football-data ${res.status}`, detail }), {
      status: res.status, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const raw = await res.json() as { matches: Array<Record<string, unknown>> };
  let matches = (raw.matches ?? []).map((m: any) => ({
    id: m.id,
    competition: m.competition?.name,
    competition_code: m.competition?.code,
    stage: m.stage,
    status: m.status,
    minute: m.minute ?? null,
    injury_time: m.injuryTime ?? null,
    utc_date: m.utcDate,
    home: { name: m.homeTeam?.name, tla: m.homeTeam?.tla, crest: m.homeTeam?.crest },
    away: { name: m.awayTeam?.name, tla: m.awayTeam?.tla, crest: m.awayTeam?.crest },
    score: {
      full: m.score?.fullTime ?? { home: null, away: null },
      half: m.score?.halfTime ?? { home: null, away: null },
    },
  }));

  // STRICT: only FIFA World Cup 2026 matches.
  matches = matches.filter((m: any) => /world cup/i.test(m.competition ?? ""));

  // If football-data didn't return World Cup matches (free tier gap),
  // fall back to API-Football (league=1 = FIFA World Cup, season=2026).
  const afKeyEarly = Deno.env.get("API_FOOTBALL_KEY");
  if (matches.length === 0 && afKeyEarly) {
    try {
      const statusMap: Record<string, string> = {
        "1H": "IN_PLAY", "2H": "IN_PLAY", "ET": "IN_PLAY", "P": "IN_PLAY",
        "HT": "PAUSED", "BT": "PAUSED",
        "FT": "FINISHED", "AET": "FINISHED", "PEN": "FINISHED",
        "NS": "SCHEDULED", "TBD": "SCHEDULED", "PST": "SCHEDULED",
      };
      const r = await fetch(
        "https://v3.football.api-sports.io/fixtures?league=1&season=2026",
        { headers: { "x-apisports-key": afKeyEarly } },
      );
      console.log("api-football WC status", r.status);
      if (r.ok) {
        const j: any = await r.json();
        console.log("api-football WC results:", j?.results, "errors:", JSON.stringify(j?.errors));
        const all: any[] = j?.response ?? [];
        // Keep a window: last 3 days finished + all upcoming, sort by date
        const now = Date.now();
        const windowStart = now - 3 * 86400_000;
        const filtered = all.filter((f: any) => {
          const t = new Date(f.fixture?.date).getTime();
          return Number.isFinite(t) && t >= windowStart;
        });
        filtered.sort((a, b) =>
          new Date(a.fixture?.date).getTime() - new Date(b.fixture?.date).getTime());
        matches = filtered.map((f: any) => ({
          id: f.fixture?.id,
          competition: f.league?.name ?? "FIFA World Cup",
          competition_code: "WC",
          stage: f.league?.round ?? null,
          status: statusMap[f.fixture?.status?.short] ?? "SCHEDULED",
          minute: f.fixture?.status?.elapsed ?? null,
          injury_time: f.fixture?.status?.extra ?? null,
          utc_date: f.fixture?.date,
          home: { name: f.teams?.home?.name, tla: (f.teams?.home?.name ?? "").slice(0, 3).toUpperCase(), crest: f.teams?.home?.logo },
          away: { name: f.teams?.away?.name, tla: (f.teams?.away?.name ?? "").slice(0, 3).toUpperCase(), crest: f.teams?.away?.logo },
          score: {
            full: { home: f.goals?.home ?? null, away: f.goals?.away ?? null },
            half: { home: f.score?.halftime?.home ?? null, away: f.score?.halftime?.away ?? null },
          },
          live_source: "api-football-wc2026",
        }));
      }
    } catch (e) {
      console.error("api-football WC fallback failed", (e as Error).message);
    }
  }





  // Enrich live/in-play matches with real-time minute + score from API-Football
  const afKey = Deno.env.get("API_FOOTBALL_KEY");
  if (afKey) {
    try {
      const liveRes = await fetch("https://v3.football.api-sports.io/fixtures?live=all", {
        headers: { "x-apisports-key": afKey },
      });
      if (liveRes.ok) {
        const liveJson: any = await liveRes.json();
        const liveFixtures: any[] = liveJson?.response ?? [];
        const norm = (s: string) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
        matches = matches.map((m: any) => {
          const hn = norm(m.home.name);
          const an = norm(m.away.name);
          const f = liveFixtures.find((x) => {
            const h = norm(x.teams?.home?.name);
            const a = norm(x.teams?.away?.name);
            return (h.includes(hn.slice(0, 5)) || hn.includes(h.slice(0, 5))) &&
                   (a.includes(an.slice(0, 5)) || an.includes(a.slice(0, 5)));
          });
          if (!f) return m;
          const status = f.fixture?.status?.short;
          const statusMap: Record<string, string> = {
            "1H": "IN_PLAY", "2H": "IN_PLAY", "ET": "IN_PLAY", "P": "IN_PLAY",
            "HT": "PAUSED", "BT": "PAUSED",
            "FT": "FINISHED", "AET": "FINISHED", "PEN": "FINISHED",
          };
          return {
            ...m,
            status: statusMap[status] ?? m.status,
            minute: f.fixture?.status?.elapsed ?? m.minute,
            injury_time: f.fixture?.status?.extra ?? m.injury_time,
            score: {
              ...m.score,
              full: {
                home: f.goals?.home ?? m.score.full.home,
                away: f.goals?.away ?? m.score.full.away,
              },
            },
            live_source: "api-football",
          };
        });
      }
    } catch (_) { /* enrichment optional */ }
  }

  // TheSportsDB enrichment — free, no key required. Used as a tiebreaker:
  // if API-Football didn't tag a match live, or its data is stale, TSDB fills gaps.
  try {
    const tsdbRes = await fetch(
      `https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${today}&s=Soccer`,
    );
    if (tsdbRes.ok) {
      const tsdbJson: any = await tsdbRes.json();
      const events: any[] = tsdbJson?.events ?? [];
      const norm = (s: string) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const parseNum = (v: any) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      };
      matches = matches.map((m: any) => {
        const hn = norm(m.home.name);
        const an = norm(m.away.name);
        const e = events.find((x) => {
          const h = norm(x.strHomeTeam);
          const a = norm(x.strAwayTeam);
          return h && a &&
            (h.includes(hn.slice(0, 5)) || hn.includes(h.slice(0, 5))) &&
            (a.includes(an.slice(0, 5)) || an.includes(a.slice(0, 5)));
        });
        if (!e) return m;
        const tsdbHome = parseNum(e.intHomeScore);
        const tsdbAway = parseNum(e.intAwayScore);
        // Prefer existing enriched values; fall back to TSDB when missing.
        const merged = {
          ...m,
          score: {
            ...m.score,
            full: {
              home: m.score.full.home ?? tsdbHome,
              away: m.score.full.away ?? tsdbAway,
            },
          },
          sources: [m.live_source, "thesportsdb"].filter(Boolean),
          tsdb_status: e.strStatus ?? null,
          tsdb_progress: e.strProgress ?? null,
        };
        // If neither football-data nor api-football flagged live, but TSDB shows a progress minute, mark live.
        if (
          (merged.status === "SCHEDULED" || merged.status === "TIMED") &&
          e.strProgress && /\d/.test(e.strProgress)
        ) {
          merged.status = "IN_PLAY";
          merged.minute = parseInt(e.strProgress, 10) || merged.minute;
        }
        return merged;
      });
    }
  } catch (_) { /* enrichment optional */ }

  // Google scrape enrichment via Firecrawl — reliable minute + score from Google's sports card.
  // Runs in parallel for all live matches.
  const fcKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (fcKey) {
    const liveIdx = matches
      .map((m: any, i: number) => ({ m, i }))
      .filter(({ m }) => ["IN_PLAY", "LIVE", "PAUSED", "SCHEDULED", "TIMED"].includes(m.status));

    await Promise.all(liveIdx.map(async ({ m, i }) => {
      try {
        const query = `${m.home.name} vs ${m.away.name} live score`;
        const fcRes = await fetch("https://api.firecrawl.dev/v2/search", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${fcKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query, limit: 3, sources: ["web"] }),
        });
        if (!fcRes.ok) return;
        const fcJson: any = await fcRes.json();
        const results: any[] = fcJson?.data?.web ?? fcJson?.data ?? [];
        // Concat titles + descriptions from top results for parsing.
        const text = results.map((r: any) => `${r.title ?? ""} ${r.description ?? r.snippet ?? ""}`).join(" ").replace(/\s+/g, " ");
        if (!text) return;

        let minute: number | null = null;
        let injury: number | null = null;
        let status = m.status;
        const htMatch = /\b(HT|Half[- ]time)\b/i.test(text);
        const ftMatch = /\b(FT|Full[- ]time|Full Time|Ended)\b/i.test(text);
        const minMatch = text.match(/(\d{1,3})(?:\s*\+\s*(\d{1,2}))?\s*['’]/);
        if (ftMatch) { status = "FINISHED"; }
        else if (htMatch) { status = "PAUSED"; }
        else if (minMatch) {
          const mn = parseInt(minMatch[1], 10);
          if (mn > 0 && mn <= 130) {
            minute = mn;
            if (minMatch[2]) injury = parseInt(minMatch[2], 10);
            status = "IN_PLAY";
          }
        }
        const scoreMatch = text.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})/);
        let sHome = m.score.full.home;
        let sAway = m.score.full.away;
        if (scoreMatch) {
          sHome = parseInt(scoreMatch[1], 10);
          sAway = parseInt(scoreMatch[2], 10);
        }
        matches[i] = {
          ...m,
          status,
          minute: minute ?? m.minute,
          injury_time: injury ?? m.injury_time,
          score: { ...m.score, full: { home: sHome, away: sAway } },
          minute_source: minute ? "google-firecrawl" : m.minute_source,
          sources: [...(m.sources ?? []), "google-firecrawl"],
        };
      } catch (e) {
        console.error("firecrawl scrape failed", (e as Error).message);
      }
    }));
  }

  // Final fallback: if still no minute, compute from kickoff time.
  matches = matches.map((m: any) => {
    if (!["IN_PLAY", "LIVE"].includes(m.status)) return m;
    if (m.minute != null && m.minute > 0) return m;
    const koMs = new Date(m.utc_date).getTime();
    if (!Number.isFinite(koMs)) return m;
    const elapsedMin = Math.floor((Date.now() - koMs) / 60000);
    if (elapsedMin <= 0) return m;
    let minute = elapsedMin;
    if (minute > 45 && minute <= 60) minute = 45;
    else if (minute > 60) minute = Math.min(minute - 15, 120);
    return { ...m, minute, minute_source: "kickoff-fallback" };
  });



  // Sort: live first, then scheduled today, then finished
  const rank = (s: string) => (["IN_PLAY", "PAUSED", "LIVE"].includes(s) ? 0 : s === "SCHEDULED" || s === "TIMED" ? 1 : 2);
  matches.sort((a: any, b: any) => rank(a.status) - rank(b.status) || a.utc_date.localeCompare(b.utc_date));

  const body = { matches, updated_at: new Date().toISOString() };
  cache = { at: Date.now(), body };

  return new Response(JSON.stringify(body), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
