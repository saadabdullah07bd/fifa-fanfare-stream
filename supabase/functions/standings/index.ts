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
      // 1) Try API-Football's World Cup top scorers first (league=1 = FIFA World Cup).
      //    That endpoint aggregates goals across qualifying + tournament, so it stays
      //    populated year-round with genuine WC-related players.
      const afKey = Deno.env.get("API_FOOTBALL_KEY");
      const season = new Date().getUTCFullYear();
      let scorers: any[] = [];
      let source = "";

      if (afKey) {
        for (const yr of [season, season - 1]) {
          try {
            const r = await fetch(
              `https://v3.football.api-sports.io/players/topscorers?league=1&season=${yr}`,
              { headers: { "x-apisports-key": afKey } },
            );
            if (!r.ok) continue;
            const j: any = await r.json();
            const list = j?.response ?? [];
            if (list.length) {
              source = `WC ${yr}`;
              scorers = list.slice(0, 20).map((x: any) => {
                const g = x.statistics?.[0]?.goals ?? {};
                const games = x.statistics?.[0]?.games ?? {};
                return {
                  player: { name: x.player?.name, nationality: x.player?.nationality, photo: x.player?.photo },
                  team: { name: x.statistics?.[0]?.team?.name, crest: x.statistics?.[0]?.team?.logo },
                  goals: g.total ?? 0,
                  assists: g.assists ?? 0,
                  penalties: null,
                  played: games.appearences ?? null,
                };
              });
              break;
            }
          } catch { /* try next season */ }
        }
      }

      // 2) Fallback chain via football-data.org (WCQ, then top club comps).
      if (!scorers.length) {
        const codes = ["WCQ", "CL", "PL", "PD", "SA", "BL1", "FL1"];
        for (const code of codes) {
          try {
            const r = await fetchJson(`/competitions/${code}/scorers?limit=20`);
            const list = r.scorers ?? [];
            if (list.length) {
              source = code;
              scorers = list.map((x: any) => ({
                player: { name: x.player?.name, nationality: x.player?.nationality },
                team: { name: x.team?.name, tla: x.team?.tla, crest: x.team?.crest },
                goals: x.goals,
                assists: x.assists,
                penalties: x.penalties,
                played: x.playedMatches,
              }));
              break;
            }
          } catch { /* try next comp */ }
        }
      }

      body.scorers_source = source || "WC";
      body.scorers = scorers;
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
