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
  const matches = (raw.matches ?? []).map((m: any) => ({
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

  // Sort: live first, then scheduled today, then finished
  const rank = (s: string) => (["IN_PLAY", "PAUSED", "LIVE"].includes(s) ? 0 : s === "SCHEDULED" || s === "TIMED" ? 1 : 2);
  matches.sort((a: any, b: any) => rank(a.status) - rank(b.status) || a.utc_date.localeCompare(b.utc_date));

  const body = { matches, updated_at: new Date().toISOString() };
  cache = { at: Date.now(), body };

  return new Response(JSON.stringify(body), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
