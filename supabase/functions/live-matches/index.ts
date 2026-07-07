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

  // Sort: live first, then scheduled today, then finished
  const rank = (s: string) => (["IN_PLAY", "PAUSED", "LIVE"].includes(s) ? 0 : s === "SCHEDULED" || s === "TIMED" ? 1 : 2);
  matches.sort((a: any, b: any) => rank(a.status) - rank(b.status) || a.utc_date.localeCompare(b.utc_date));

  const body = { matches, updated_at: new Date().toISOString() };
  cache = { at: Date.now(), body };

  return new Response(JSON.stringify(body), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
