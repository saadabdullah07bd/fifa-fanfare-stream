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
  let bodyKind = "";
  if (req.method !== "GET") {
    try {
      const body = await req.clone().json();
      bodyKind = typeof body?.kind === "string" ? body.kind : "";
    } catch { /* no JSON body */ }
  }
  const kind = (url.searchParams.get("kind") ?? bodyKind) || "standings"; // standings | scorers | all
  const cacheKey = `v3:${kind}`;
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
      // WC 2026 has NOT kicked off yet — only qualification is underway.
      // Aggregate top scorers across all 6 confederation WCQ competitions on
      // API-Football (season = current year). Fall back to Wikipedia scrape,
      // then football-data WCQ.
      let scorers: any[] = [];
      let source = "";
      const debug: any = { afKey: false, afLeagues: {}, wikiFound: 0, fdFound: 0 };

      const afKey = Deno.env.get("API_FOOTBALL_KEY");
      debug.afKey = !!afKey;
      if (afKey) {
        const leagues = [32, 34, 29, 30, 31, 33];
        const season = new Date().getUTCFullYear();
        const merged = new Map<string, any>();
        await Promise.all(leagues.map(async (lg) => {
          for (const yr of [season, season - 1, season - 2]) {
            try {
              const r = await fetch(
                `https://v3.football.api-sports.io/players/topscorers?league=${lg}&season=${yr}`,
                { headers: { "x-apisports-key": afKey } },
              );
              const j: any = await r.json().catch(() => ({}));
              const list = j?.response ?? [];
              debug.afLeagues[`${lg}_${yr}`] = { status: r.status, count: list.length, errors: j?.errors };
              if (!r.ok || !list.length) continue;
              for (const x of list) {
                const g = x.statistics?.[0]?.goals ?? {};
                const games = x.statistics?.[0]?.games ?? {};
                const name = x.player?.name;
                if (!name) continue;
                const key = name.toLowerCase();
                const goals = g.total ?? 0;
                const row = {
                  player: { name, nationality: x.player?.nationality, photo: x.player?.photo },
                  team: { name: x.statistics?.[0]?.team?.name, crest: x.statistics?.[0]?.team?.logo },
                  goals,
                  assists: g.assists ?? null,
                  penalties: null,
                  played: games.appearences ?? null,
                };
                const prev = merged.get(key);
                if (!prev || goals > prev.goals) merged.set(key, row);
              }
              break;
            } catch (e) {
              debug.afLeagues[`${lg}_${yr}`] = { error: (e as Error).message };
            }
          }
        }));
        if (merged.size) {
          scorers = [...merged.values()].sort((a, b) => b.goals - a.goals).slice(0, 20);
          source = "API-Football WCQ";
        }
      }

      if (!scorers.length) {
        try {
          const wiki = await scrapeWikipediaWCQScorers();
          debug.wikiFound = wiki.length;
          if (wiki.length) { scorers = wiki; source = "Wikipedia WCQ"; }
        } catch (e) { debug.wikiError = (e as Error).message; }
      }

      if (!scorers.length) {
        try {
          const r = await fetchJson(`/competitions/WCQ/scorers?limit=20`);
          const list = r.scorers ?? [];
          debug.fdFound = list.length;
          if (list.length) {
            source = "football-data WCQ";
            scorers = list.map((x: any) => ({
              player: { name: x.player?.name, nationality: x.player?.nationality },
              team: { name: x.team?.name, tla: x.team?.tla, crest: x.team?.crest },
              goals: x.goals,
              assists: x.assists,
              penalties: x.penalties,
              played: x.playedMatches,
            }));
          }
        } catch (e) { debug.fdError = (e as Error).message; }
      }

      body.scorers_source = source || "none";
      body.scorers = scorers;
      if (url.searchParams.get("debug") === "1") body.debug = debug;
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

// Scrape the "Top goalscorers" table from Wikipedia's WC 2026 qualification page.
async function scrapeWikipediaWCQScorers() {
  const url = "https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_qualification";
  const r = await fetch(url, {
    headers: {
      "accept": "text/html",
      "user-agent": "Mozilla/5.0 (compatible; FanfareBot/1.0)",
    },
  });
  if (!r.ok) return [];
  const html = await r.text();

  const secIdx = html.search(/id="Top_goalscorers"|>Top goalscorers</i);
  if (secIdx < 0) return [];
  const rest = html.slice(secIdx);
  const tblMatch = rest.match(/<table[^>]*class="[^"]*wikitable[^"]*"[\s\S]*?<\/table>/i);
  if (!tblMatch) return [];
  const table = tblMatch[0];

  const rows: any[] = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m: RegExpExecArray | null;
  while ((m = trRe.exec(table))) {
    const tr = m[1];
    if (/<th[\s>]/i.test(tr) && !/<td[\s>]/i.test(tr)) continue;

    let country = "";
    const flag = tr.match(/class="[^"]*flagicon[^"]*"[\s\S]*?title="([^"]+)"/i)
      ?? tr.match(/class="[^"]*flagicon[^"]*"[\s\S]*?alt="([^"]+)"/i);
    if (flag) country = flag[1];

    const cells: string[] = [];
    const tdRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let c: RegExpExecArray | null;
    while ((c = tdRe.exec(tr))) cells.push(c[1]);
    if (cells.length < 3) continue;

    const cellsText = cells.map(x => decodeEntities(stripTags(x)).trim());

    let playerName = "";
    for (const cell of cells) {
      const aMatches = [...cell.matchAll(/<a[^>]*title="([^"]+)"[^>]*>([^<]+)<\/a>/gi)];
      for (const a of aMatches) {
        const title = a[1];
        const label = decodeEntities(a[2]).trim();
        if (title === country) continue;
        if (!label || /^\d+$/.test(label)) continue;
        if (/^(Hat-trick|Own goal|edit)$/i.test(label)) continue;
        playerName = label;
        break;
      }
      if (playerName) break;
    }

    let goals = 0;
    for (const t of cellsText) {
      const digits = t.replace(/[^\d]/g, "");
      const n = Number(digits);
      if (Number.isFinite(n) && n > 0 && n < 40 && digits === t) {
        goals = Math.max(goals, n);
      }
    }

    if (!playerName || !goals) continue;
    rows.push({
      player: { name: playerName, nationality: country || null },
      team: { name: country || "National team" },
      goals,
      assists: null,
      penalties: null,
      played: null,
    });
  }

  const dedup = new Map<string, any>();
  for (const row of rows) {
    const k = row.player.name.toLowerCase();
    const prev = dedup.get(k);
    if (!prev || row.goals > prev.goals) dedup.set(k, row);
  }
  return [...dedup.values()].sort((a, b) => b.goals - a.goals).slice(0, 20);
}

function stripTags(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<sup[\s\S]*?<\/sup>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

function decodeEntities(text: string) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
