/**
 * Match Detail Function
 * Purpose: Provides match details from football-data.org with optional
 *          API-Football enrichment for live minute/score.
 * HTTP Method: GET
 * Inputs: id — football-data.org match id
 *
 * Firecrawl/Gemini enrichment was removed: regex-mining search snippets and
 * LLM-generated scores have no ground truth and produced incorrect live data.
 */

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const token = Deno.env.get("FOOTBALL_DATA_API_TOKEN");
  if (!token) {
    return new Response(JSON.stringify({ error: "token missing" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return new Response(JSON.stringify({ error: "id required" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const res = await fetch(`https://api.football-data.org/v4/matches/${id}`, {
    headers: { "X-Auth-Token": token },
  });
  if (!res.ok) {
    return new Response(JSON.stringify({ error: `fd ${res.status}`, detail: await res.text() }), {
      status: res.status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const m: Record<string, unknown> = await res.json();

  const out: Record<string, unknown> = {
    id: m.id,
    competition: (m.competition as { name?: string })?.name,
    status: m.status,
    minute: m.minute ?? null,
    injury_time: m.injuryTime ?? null,
    utc_date: m.utcDate,
    venue: m.venue ?? null,
    referees: ((m.referees as Array<{ name: string }>) ?? []).map((r) => r.name),
    home: {
      name: (m.homeTeam as { name?: string })?.name,
      tla: (m.homeTeam as { tla?: string })?.tla,
      crest: (m.homeTeam as { crest?: string })?.crest,
      id: (m.homeTeam as { id?: number })?.id,
    },
    away: {
      name: (m.awayTeam as { name?: string })?.name,
      tla: (m.awayTeam as { tla?: string })?.tla,
      crest: (m.awayTeam as { crest?: string })?.crest,
      id: (m.awayTeam as { id?: number })?.id,
    },
    score: {
      full: (m.score as { fullTime?: unknown })?.fullTime ?? { home: null, away: null },
      half: (m.score as { halfTime?: unknown })?.halfTime ?? { home: null, away: null },
      winner: (m.score as { winner?: unknown })?.winner ?? null,
    },
    goals: ((m.goals as Array<Record<string, unknown>>) ?? []).map((g) => ({
      minute: g.minute,
      injury_time: g.injuryTime ?? null,
      type: g.type ?? "REGULAR",
      team_tla: (g.team as { tla?: string })?.tla,
      team_name: (g.team as { name?: string })?.name,
      scorer: (g.scorer as { name?: string })?.name,
      assist: (g.assist as { name?: string })?.name ?? null,
      score: g.score ?? null,
    })),
    bookings: ((m.bookings as Array<Record<string, unknown>>) ?? []).map((b) => ({
      minute: b.minute,
      card: b.card,
      player: (b.player as { name?: string })?.name,
      team_tla: (b.team as { tla?: string })?.tla,
    })),
    substitutions: ((m.substitutions as unknown[]) ?? []).length,
  };

  const afKey = Deno.env.get("API_FOOTBALL_KEY");
  const status = String(out.status ?? "");
  if (afKey && ["IN_PLAY", "PAUSED", "LIVE", "SCHEDULED", "TIMED"].includes(status)) {
    try {
      const norm = (s: string) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const dayISO = String(out.utc_date ?? "").slice(0, 10);
      const searchUrl = dayISO
        ? `https://v3.football.api-sports.io/fixtures?date=${dayISO}`
        : `https://v3.football.api-sports.io/fixtures?live=all`;
      const r = await fetch(searchUrl, { headers: { "x-apisports-key": afKey } });
      if (r.ok) {
        const j = (await r.json()) as { response?: Array<Record<string, unknown>> };
        const fixtures = j?.response ?? [];
        const homeName = String((out.home as { name?: string }).name ?? "");
        const awayName = String((out.away as { name?: string }).name ?? "");
        const hn = norm(homeName);
        const an = norm(awayName);
        const f = fixtures.find((x) => {
          const teams = x.teams as {
            home?: { name?: string };
            away?: { name?: string };
          };
          const h = norm(teams?.home?.name ?? "");
          const a = norm(teams?.away?.name ?? "");
          return (
            (h.includes(hn.slice(0, 5)) || hn.includes(h.slice(0, 5))) &&
            (a.includes(an.slice(0, 5)) || an.includes(a.slice(0, 5)))
          );
        });
        if (f) {
          const fixture = f.fixture as {
            status?: { short?: string; elapsed?: number; extra?: number; long?: string };
            id?: number;
          };
          const shortStatus = fixture?.status?.short;
          const statusMap: Record<string, string> = {
            "1H": "IN_PLAY",
            "2H": "IN_PLAY",
            ET: "IN_PLAY",
            P: "IN_PLAY",
            HT: "PAUSED",
            BT: "PAUSED",
            FT: "FINISHED",
            AET: "FINISHED",
            PEN: "FINISHED",
          };
          out.status = statusMap[shortStatus ?? ""] ?? out.status;
          out.minute = fixture?.status?.elapsed ?? out.minute;
          out.injury_time = fixture?.status?.extra ?? out.injury_time;
          out.status_short = shortStatus;
          out.status_long = fixture?.status?.long;
          const goals = f.goals as { home?: number; away?: number };
          const score = out.score as { full: { home: number | null; away: number | null } };
          if (goals?.home != null) score.full.home = goals.home;
          if (goals?.away != null) score.full.away = goals.away;
          out.live_source = "api-football";
          out.af_fixture_id = fixture?.id;
        }
      }
    } catch {
      /* optional enrichment */
    }
  }

  return new Response(JSON.stringify(out), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
