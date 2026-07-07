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
  const cacheKey = `v5:${kind}`;
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
      // WC 2026 hasn't kicked off yet — top scorers = WC qualification scorers.
      // API-Football's free plan is capped at seasons 2022-2024 so it can't
      // return current qualifier data. Instead scrape each confederation's
      // Wikipedia qualification article via the MediaWiki API (structured and
      // reliable) and merge the "Top scorers" tables.
      let scorers: any[] = [];
      let source = "";
      const debug: any = { pages: {} };

      try {
        const wiki = await scrapeAllConfederationScorers(debug);
        if (wiki.length) { scorers = wiki; source = "Wikipedia WCQ"; }
      } catch (e) { debug.wikiError = (e as Error).message; }

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

const CONFED_PAGES = [
  "2026 FIFA World Cup qualification (UEFA)",
  "2026 FIFA World Cup qualification (CONMEBOL)",
  "2026 FIFA World Cup qualification (AFC)",
  "2026 FIFA World Cup qualification (CAF)",
  "2026 FIFA World Cup qualification (CONCACAF)",
  "2026 FIFA World Cup qualification (OFC)",
];

async function scrapeAllConfederationScorers(debug: any) {
  const merged = new Map<string, any>();
  await Promise.all(CONFED_PAGES.map(async (page) => {
    try {
      const rows = await scrapePageScorers(page, debug);
      for (const row of rows) {
        const key = row.player.name.toLowerCase();
        const prev = merged.get(key);
        if (!prev || row.goals > prev.goals) merged.set(key, row);
      }
    } catch (e) {
      debug.pages[page] = { error: (e as Error).message };
    }
  }));
  return [...merged.values()]
    .sort((a, b) => b.goals - a.goals)
    .slice(0, 20);
}

async function scrapePageScorers(page: string, debug: any) {
  const api = "https://en.wikipedia.org/w/api.php";
  const ua = "FanfareBot/1.0 (contact: support@lovable.app)";

  // 1. List sections, find one that looks like "Top scorers"/"Goalscorers".
  const secRes = await fetch(
    `${api}?action=parse&page=${encodeURIComponent(page)}&prop=sections&format=json&redirects=1`,
    { headers: { "user-agent": ua } },
  );
  if (!secRes.ok) { debug.pages[page] = { status: secRes.status }; return []; }
  const secJson: any = await secRes.json();
  const sections: any[] = secJson?.parse?.sections ?? [];
  const target = sections.find((s: any) =>
    /goal ?scorers?|top scorers?/i.test(s.line ?? "")
  );
  if (!target) {
    debug.pages[page] = { sections: sections.length, missing: true };
    return [];
  }

  // 2. Fetch that section's HTML.
  const txtRes = await fetch(
    `${api}?action=parse&page=${encodeURIComponent(page)}&prop=text&section=${target.index}&format=json&redirects=1`,
    { headers: { "user-agent": ua } },
  );
  if (!txtRes.ok) { debug.pages[page] = { textStatus: txtRes.status }; return []; }
  const txtJson: any = await txtRes.json();
  const html: string = txtJson?.parse?.text?.["*"] ?? "";

  const rows = parseScorerTable(html);
  debug.pages[page] = { section: target.line, rows: rows.length };
  return rows;
}

function parseScorerTable(html: string) {
  const rows: any[] = [];

  // Wikipedia's WC qualification "Top scorers" sections use a list format:
  //   <p><b>16 goals</b></p><div class="div-col"><ul><li>[flag][player]</li>...
  // Parse each "N goal(s)" heading and then extract player <li>s until the
  // next heading.
  const headingRe = /<(?:p|h[1-6])[^>]*>[\s\S]*?<b>\s*(\d{1,2})\s+goals?\s*<\/b>/gi;
  const matches = [...html.matchAll(headingRe)];
  for (let i = 0; i < matches.length; i++) {
    const goals = Number(matches[i][1]);
    const start = matches[i].index! + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : html.length;
    const chunk = html.slice(start, end);

    const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let li: RegExpExecArray | null;
    while ((li = liRe.exec(chunk))) {
      const cell = li[1];
      // country = title of the flagicon's <a> link
      let country = "";
      const flag = cell.match(/class="[^"]*flagicon[^"]*"[\s\S]*?title="([^"]+)"/i)
        ?? cell.match(/class="[^"]*flagicon[^"]*"[\s\S]*?alt="([^"]+)"/i);
      if (flag) country = flag[1].replace(/\s+national football team$/i, "").trim();

      // player name = first <a title="..."> whose title isn't the flag country
      let playerName = "";
      for (const a of cell.matchAll(/<a[^>]*title="([^"]+)"[^>]*>([^<]+)<\/a>/gi)) {
        const title = a[1];
        const label = decodeEntities(a[2]).trim();
        if (/national football team$/i.test(title)) continue;
        if (!label || label.length < 2 || /^\d+$/.test(label)) continue;
        if (/^(edit|note)$/i.test(label)) continue;
        playerName = label;
        break;
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
  }

  // Fallback: table-based layout (some confederations may use it).
  if (!rows.length) {
    const tblMatch = html.match(/<table[^>]*class="[^"]*wikitable[^"]*"[\s\S]*?<\/table>/i);
    if (tblMatch) {
      const table = tblMatch[0];
      const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let m: RegExpExecArray | null;
      while ((m = trRe.exec(table))) {
        const tr = m[1];
        if (/<th[\s>]/i.test(tr) && !/<td[\s>]/i.test(tr)) continue;
        let country = "";
        const flag = tr.match(/class="[^"]*flagicon[^"]*"[\s\S]*?title="([^"]+)"/i);
        if (flag) country = flag[1].replace(/\s+national football team$/i, "").trim();
        const cells: string[] = [];
        const tdRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
        let c: RegExpExecArray | null;
        while ((c = tdRe.exec(tr))) cells.push(c[1]);
        if (cells.length < 2) continue;
        let playerName = "";
        for (const cell of cells) {
          for (const a of cell.matchAll(/<a[^>]*title="([^"]+)"[^>]*>([^<]+)<\/a>/gi)) {
            if (/national football team$/i.test(a[1])) continue;
            const label = decodeEntities(a[2]).trim();
            if (!label || /^\d+$/.test(label)) continue;
            playerName = label; break;
          }
          if (playerName) break;
        }
        let goals = 0;
        for (const cell of cells) {
          const t = decodeEntities(stripTags(cell)).trim();
          const digits = t.replace(/[^\d]/g, "");
          const n = Number(digits);
          if (Number.isFinite(n) && n > 0 && n < 40 && digits === t) goals = Math.max(goals, n);
        }
        if (!playerName || !goals) continue;
        rows.push({
          player: { name: playerName, nationality: country || null },
          team: { name: country || "National team" },
          goals, assists: null, penalties: null, played: null,
        });
      }
    }
  }

  return rows;
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

