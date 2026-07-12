/**
 * Club Search & Overview Function
 * Purpose: Public proxy for API-Football to search clubs and fetch dashboard data.
 * HTTP Method: GET, POST
 * Inputs:
 *   - action: "search" | "overview" (default: "search")
 *   - q: Search string (for search)
 *   - teamId: Numeric ID of the team (for overview)
 * Outputs: JSON list of teams or team overview details (squad, fixtures).
 * External APIs: API-Football (v3.football.api-sports.io)
 */

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const AF = "https://v3.football.api-sports.io";
const cache = new Map<string, { at: number; body: unknown }>();
const TTL = 60_000;

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const key = Deno.env.get("API_FOOTBALL_KEY");
  if (!key) return json({ error: "API_FOOTBALL_KEY missing" }, 500);

  // Accept params from either URL or JSON body (supabase.functions.invoke posts JSON)
  const url = new URL(req.url);
  let body: Record<string, unknown> = {};
  if (req.method === "POST") { try { body = await req.json(); } catch { /* empty */ } }
  const action = String(body.action ?? url.searchParams.get("action") ?? "search");
  
  // In-memory caching to stay within API rate limits
  const cacheKey = JSON.stringify({ action, body, s: url.search });
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL) return json(hit.body);

  const headers = { "x-apisports-key": key };
  /** Fetches data from API-Football and handles errors */
  const fetchJson = async (path: string) => {
    const r = await fetch(`${AF}${path}`, { headers });
    if (!r.ok) throw new Error(`api-football ${r.status}`);
    return r.json();
  };

  try {
    if (action === "search") {
      const q = String(body.q ?? url.searchParams.get("q") ?? "").trim();
      if (q.length < 3) return json({ teams: [] });
      const r = await fetchJson(`/teams?search=${encodeURIComponent(q)}`);
      const teams = (r.response ?? [])
        .filter((x: any) => x.team && !x.team.national)
        .slice(0, 12)
        .map((x: any) => ({
          id: x.team.id, name: x.team.name, code: x.team.code,
          country: x.team.country, logo: x.team.logo, founded: x.team.founded,
          venue: x.venue?.name,
        }));
      cache.set(cacheKey, { at: Date.now(), body: { teams } });
      return json({ teams });
    }

    if (action === "overview") {
      const teamId = Number(body.teamId ?? url.searchParams.get("teamId"));
      if (!teamId) return json({ error: "teamId required" }, 400);
      const season = new Date().getUTCFullYear();
      // Fetch multiple resources in parallel for the dashboard
      const [teamRes, nextRes, lastRes, squadRes] = await Promise.all([
        fetchJson(`/teams?id=${teamId}`),
        fetchJson(`/fixtures?team=${teamId}&next=5`),
        fetchJson(`/fixtures?team=${teamId}&last=5`),
        fetchJson(`/players/squads?team=${teamId}`),
      ]);
      const team = teamRes.response?.[0] ?? null;
      const mapFx = (f: any) => ({
        id: f.fixture.id, date: f.fixture.date, status: f.fixture.status?.short,
        minute: f.fixture.status?.elapsed,
        league: { name: f.league?.name, logo: f.league?.logo, round: f.league?.round },
        home: { name: f.teams?.home?.name, logo: f.teams?.home?.logo, id: f.teams?.home?.id },
        away: { name: f.teams?.away?.name, logo: f.teams?.away?.logo, id: f.teams?.away?.id },
        goals: f.goals,
      });
      const squad = squadRes.response?.[0]?.players ?? [];
      const out = {
        team: team ? {
          id: team.team.id, name: team.team.name, logo: team.team.logo,
          country: team.team.country, founded: team.team.founded,
          venue: { name: team.venue?.name, city: team.venue?.city, capacity: team.venue?.capacity, image: team.venue?.image },
        } : null,
        upcoming: (nextRes.response ?? []).map(mapFx),
        recent: (lastRes.response ?? []).map(mapFx),
        squad: squad.slice(0, 24).map((p: any) => ({
          id: p.id, name: p.name, age: p.age, number: p.number,
          position: p.position, photo: p.photo,
        })),
        season,
      };
      cache.set(cacheKey, { at: Date.now(), body: out });
      return json(out);
    }

    return json({ error: `unknown action ${action}` }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
});

/** Helper for JSON responses with CORS headers */
function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
}
