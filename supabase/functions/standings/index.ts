/**
 * Standings & Scorers Function
 * Purpose: Provides World Cup standings and top scorer data.
 * HTTP Method: GET
 * Inputs:
 *   - kind: "standings" | "scorers" | "all" (default: "standings")
 *   - debug: "1" to include scraping metadata.
 * Outputs: JSON object with requested statistics and tournament status.
 * Sources:
 *   - Bundled wc26-matches.json: primary Golden Boot (real tournament goals).
 *   - WorldCupWiki / Wikipedia scrapes: keyless fallbacks.
 *
 * football-data.org was removed 2026-07-16 with its API key: the free tier
 * carried no WC26 standings or scorers, so those calls only ever errored.
 * Group tables are not derivable from the bundled dataset (it has no group
 * letters), so kind=standings now returns an empty list the UI already
 * handles with its "no group data" state.
 */

import wc26 from "../_shared/wc26-matches.json" assert { type: "json" };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const cache = new Map<string, { at: number; body: unknown }>();
const TTL = 60_000;

/**
 * Golden Boot computed from the bundled dataset's real goal records.
 * Team attribution per player is a majority vote across that player's goal
 * rows, which rides out isolated team-tag errors in the source data.
 */
function scorersFromDataset() {
  const codeByTeam = new Map<string, string>();
  for (const m of wc26 as any[]) {
    if (m.home_name && m.home_code) codeByTeam.set(m.home_name, m.home_code);
    if (m.away_name && m.away_code) codeByTeam.set(m.away_name, m.away_code);
  }
  const tally = new Map<string, { goals: number; penalties: number; teams: Map<string, number> }>();
  for (const m of wc26 as any[]) {
    for (const g of m.goals ?? []) {
      if (!g?.player || g.type === "OG") continue;
      const t = tally.get(g.player) ?? { goals: 0, penalties: 0, teams: new Map() };
      t.goals += 1;
      if (g.type === "PEN") t.penalties += 1;
      const team = g.team ?? null;
      if (team) t.teams.set(team, (t.teams.get(team) ?? 0) + 1);
      tally.set(g.player, t);
    }
  }
  return [...tally.entries()]
    .map(([player, t]) => {
      const team = [...t.teams.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      return {
        player: { name: player, nationality: team },
        team: { name: team, tla: team ? (codeByTeam.get(team) ?? null) : null, crest: null },
        goals: t.goals,
        assists: null,
        penalties: t.penalties || null,
        played: null,
      };
    })
    .sort((a, b) => b.goals - a.goals)
    .slice(0, 20);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const url = new URL(req.url);
  let bodyKind = "";
  if (req.method !== "GET") {
    try {
      const body = await req.clone().json();
      bodyKind = typeof body?.kind === "string" ? body.kind : "";
    } catch {
      /* no JSON body */
    }
  }
  const kind = (url.searchParams.get("kind") ?? bodyKind) || "standings";
  const cacheKey = `v8:${kind}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < TTL) return json(cached.body);

  try {
    const body: Record<string, unknown> = {};

    if (kind === "standings" || kind === "all") {
      // No keyed provider carries WC26 group tables and the bundled dataset
      // has no group letters; the UI shows its empty state for this.
      body.standings = [];
      body.season = null;
    }

    if (kind === "scorers" || kind === "all") {
      let scorers: any[] = [];
      let source = "";
      const debug: any = { pages: {} };

      // Primary: the bundled dataset (real, verified tournament goals).
      scorers = scorersFromDataset();
      if (scorers.length) source = "wc26-dataset";

      if (!scorers.length) {
        try {
          const web = await scrapeWorldCupWikiGoldenBoot(debug);
          if (web.length) {
            scorers = web;
            source = "WorldCupWiki";
          }
        } catch (e) {
          debug.worldCupWikiError = (e as Error).message;
        }
      }

      if (!scorers.length) {
        try {
          const wiki = await scrapeAllConfederationScorers(debug);
          if (wiki.length) {
            scorers = wiki;
            source = "Wikipedia WCQ";
          }
        } catch (e) {
          debug.wikiError = (e as Error).message;
        }
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

/** Standard JSON response helper. Adds CDN cache headers on 2xx replies so
 *  peak traffic (target: 50k concurrent) can be served from Cloudflare. */
function json(body: unknown, status = 200) {
  const cacheable = status >= 200 && status < 300;
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
      ...(cacheable
        ? { "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=120" }
        : {}),
    },
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

const COUNTRY_BY_FLAG: Record<string, string> = {
  "🇫🇷": "France",
  "🇦🇷": "Argentina",
  "🇳🇴": "Norway",
  "🏴": "England",
  "🇧🇷": "Brazil",
  "🇲🇽": "Mexico",
  "🇩🇪": "Germany",
  "🇨🇭": "Switzerland",
  "🇸🇳": "Senegal",
  "🇳🇱": "Netherlands",
  "🇨🇩": "DR Congo",
  "🇨🇦": "Canada",
  "🇲🇦": "Morocco",
};

/** Scrapes the WorldCupWiki Golden Boot standings */
async function scrapeWorldCupWikiGoldenBoot(debug: any) {
  const url = "https://worldcupwiki.com/world-cup-2026-golden-boot-standings/";
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 Pitch26/1.0 (+https://lovable.app)",
      accept: "text/html,application/xhtml+xml",
    },
  });
  debug.worldCupWikiStatus = res.status;
  if (!res.ok) return [];
  const html = await res.text();
  const rows: any[] = [];
  for (const table of html.matchAll(/<table[^>]*>[\s\S]*?<\/table>/gi)) {
    for (const match of table[0].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...match[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) =>
        decodeEntities(stripTags(cell[1])).trim(),
      );
      if (cells.length < 5 || !/^\d+$/.test(cells[0])) continue;
      const country = cleanCountry(cells[2]);
      const goals = Number(cells[3].replace(/\D/g, ""));
      const assists = Number(cells[4].replace(/\D/g, ""));
      if (!cells[1] || !Number.isFinite(goals)) continue;
      rows.push({
        player: { name: cells[1], nationality: country },
        team: { name: country || "National team" },
        goals,
        assists: Number.isFinite(assists) ? assists : null,
        penalties: null,
        // This source's 6th column is minutes, not matches played — leaving it
        // null so the UI shows "—" instead of a misleading matches-played count.
        played: null,
      });
    }
  }

  debug.worldCupWikiFound = rows.length;
  return rows.sort((a, b) => b.goals - a.goals || (b.assists ?? 0) - (a.assists ?? 0)).slice(0, 20);
}

/** Sanitizes and normalizes country names from messy HTML/Emoji input */
function cleanCountry(value: string) {
  const stripped = value
    .replace(/[\u{1F1E6}-\u{1F1FF}\u{1F3F4}\u{E0061}-\u{E007A}\u{E007F}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped) return stripped.replace(/\b(.+?)\s+\1\b/i, "$1");
  for (const [flag, name] of Object.entries(COUNTRY_BY_FLAG)) {
    if (value.includes(flag)) return name;
  }
  return "";
}

/** Merges scorer data across all confederation Wikipedia pages */
async function scrapeAllConfederationScorers(debug: any) {
  const merged = new Map<string, any>();
  await Promise.all(
    CONFED_PAGES.map(async (page) => {
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
    }),
  );
  return [...merged.values()].sort((a, b) => b.goals - a.goals).slice(0, 20);
}

/** Scrapes scorer lists from a single Wikipedia qualification page */
async function scrapePageScorers(page: string, debug: any) {
  const api = "https://en.wikipedia.org/w/api.php";
  const ua = "FanfareBot/1.0 (contact: support@lovable.app)";

  // 1. List sections to find scorers section
  const secRes = await fetch(
    `${api}?action=parse&page=${encodeURIComponent(page)}&prop=sections&format=json&redirects=1`,
    { headers: { "user-agent": ua } },
  );
  if (!secRes.ok) {
    debug.pages[page] = { status: secRes.status };
    return [];
  }
  const secJson: any = await secRes.json();
  const sections: any[] = secJson?.parse?.sections ?? [];
  const target = sections.find((s: any) => /goal ?scorers?|top scorers?/i.test(s.line ?? ""));
  if (!target) {
    debug.pages[page] = { sections: sections.length, missing: true };
    return [];
  }

  // 2. Fetch section HTML
  const txtRes = await fetch(
    `${api}?action=parse&page=${encodeURIComponent(page)}&prop=text&section=${target.index}&format=json&redirects=1`,
    { headers: { "user-agent": ua } },
  );
  if (!txtRes.ok) {
    debug.pages[page] = { textStatus: txtRes.status };
    return [];
  }
  const txtJson: any = await txtRes.json();
  const html: string = txtJson?.parse?.text?.["*"] ?? "";

  const rows = parseScorerTable(html);
  debug.pages[page] = { section: target.line, rows: rows.length };
  return rows;
}

/** Parses Wikipedia Goalscorers section into structured objects */
function parseScorerTable(html: string) {
  const rows: any[] = [];
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
      let country = "";
      const flag =
        cell.match(/class="[^"]*flagicon[^"]*"[\s\S]*?title="([^"]+)"/i) ??
        cell.match(/class="[^"]*flagicon[^"]*"[\s\S]*?alt="([^"]+)"/i);
      if (flag) {
        country = decodeEntities(flag[1])
          .replace(/\s+(?:men'?s\s+)?national football team$/i, "")
          .replace(/\s+men'?s$/i, "")
          .trim();
      }

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

  // Fallback: table-based layout
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
            playerName = label;
            break;
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
          goals,
          assists: null,
          penalties: null,
          played: null,
        });
      }
    }
  }
  return rows;
}

/** Strips all HTML tags and noise from a string */
function stripTags(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<sup[\s\S]*?<\/sup>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

/** Decodes HTML entities to plain text */
function decodeEntities(text: string) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
