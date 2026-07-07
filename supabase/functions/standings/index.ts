// Public read-only proxy for World Cup standings + top scorers via football-data.org.
// Cached in-memory for 60s to stay well under the 10 req/min free-tier limit.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const FD = "https://api.football-data.org/v4";
const cache = new Map<string, { at: number; body: unknown }>();
const TTL = 60_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const token = Deno.env.get("FOOTBALL_DATA_API_TOKEN");
  if (!token) {
    return json({ error: "FOOTBALL_DATA_API_TOKEN missing" }, 500);
  }

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") ?? "standings"; // standings | scorers | all
  const cacheKey = kind;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < TTL) return json(cached.body);

  try {
    const headers = { "X-Auth-Token": token };
    const fetchJson = async (path: string) => {
      const r = await fetch(`${FD}${path}`, { headers });
      if (!r.ok) throw new Error(`football-data ${r.status} ${await r.text()}`);
      return r.json();
    };

    const body: Record<string, unknown> = {};

    if (kind === "standings" || kind === "all") {
      const s = await fetchJson("/competitions/WC/standings");
      body.standings = (s.standings ?? []).map((g: any) => ({
        group: g.group,
        stage: g.stage,
        type: g.type,
        table: (g.table ?? []).map((row: any) => ({
          position: row.position,
          team: {
            name: row.team?.name,
            tla: row.team?.tla,
            crest: row.team?.crest,
          },
          played: row.playedGames,
          won: row.won,
          draw: row.draw,
          lost: row.lost,
          points: row.points,
          gf: row.goalsFor,
          ga: row.goalsAgainst,
          gd: row.goalDifference,
          form: row.form,
        })),
      }));
      body.season = s.season ?? null;
    }

    if (kind === "scorers" || kind === "all") {
      // Aggregate scorers across all World Cup qualification confederations +
      // the main tournament, so the list is populated year-round.
      const codes = ["WC", "WCQ", "CLI", "EL", "CL", "PL", "PD", "SA", "BL1", "FL1"];
      const results = await Promise.all(codes.map(async (code) => {
        try {
          const r = await fetchJson(`/competitions/${code}/scorers?limit=20`);
          return { code, scorers: r.scorers ?? [] };
        } catch { return { code, scorers: [] as any[] }; }
      }));

      // Prefer WC, then WCQ, then any club competition that returns data.
      const primary = results.find((r) => r.code === "WC" && r.scorers.length)
        ?? results.find((r) => r.code === "WCQ" && r.scorers.length)
        ?? results.find((r) => r.scorers.length)
        ?? { code: "WC", scorers: [] };

      body.scorers_source = primary.code;
      body.scorers = primary.scorers.slice(0, 20).map((x: any) => ({
        player: { name: x.player?.name, nationality: x.player?.nationality },
        team: { name: x.team?.name, tla: x.team?.tla, crest: x.team?.crest },
        goals: x.goals,
        assists: x.assists,
        penalties: x.penalties,
        played: x.playedMatches,
      }));
    }

    body.updated_at = new Date().toISOString();
    cache.set(cacheKey, { at: Date.now(), body });
    return json(body);
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
}
