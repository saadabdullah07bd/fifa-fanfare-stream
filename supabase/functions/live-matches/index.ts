/**
 * Live Matches Function
 * Purpose: Aggregates live and recent football matches, primarily focusing on World Cup 2026.
 * HTTP Method: GET
 * Inputs:
 *   - status: Optional filter for match status (e.g., LIVE, FINISHED).
 * Outputs: JSON object with matches and last updated timestamp.
 * External APIs:
 *   - ESPN scoreboard JSON: Primary match source.
 *   - Football-Data.org: Fallback match source.
 *   - TheSportsDB: Last-resort fallback for World Cup 2026 fixtures.
 *
 * Note: this used to also "enrich" scores/minutes via a Firecrawl web-search
 * text scrape and a Gemini prompt asking an LLM to invent a live score as
 * JSON. Both were removed — an LLM has no ground truth for a live score, and
 * regex-mining arbitrary search-result text for a "N-N" pattern will happily
 * match an unrelated article, prediction, or betting line. That combination
 * was the source of scores that didn't match reality (e.g. showing a result
 * for a match that hadn't kicked off yet). Only real provider data is used now.
 *
 * Source order: ESPN's public scoreboard JSON (primary) -> football-data.org ->
 * TheSportsDB. ESPN is preferred because the `fifa.world` league feed is already
 * scoped to the World Cup, needs no API key, carries a real per-match clock, and
 * ships goal/card events in `competitions[0].details`. It is a structured feed,
 * NOT an HTML scrape: do not replace it with one. A score here must always trace
 * back to a provider field — never to text matched out of a web page.
 */

import { ESPN_SCOREBOARD, espnDay, mapEspnScoreboard, sortMatches } from "../_shared/espn.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const FD = "https://api.football-data.org/v4";
let cache: { at: number; body: unknown } | null = null;

/**
 * Primary source. The `fifa.world` feed is World Cup-only, so no competition
 * filtering is needed. Throws on transport/HTTP failure so the caller falls
 * through to football-data.org.
 */
async function fetchEspn(): Promise<any[]> {
  // Range covers yesterday..tomorrow (UTC) so a match that kicked off before
  // UTC midnight is still returned while it is in play.
  const url = `${ESPN_SCOREBOARD}?dates=${espnDay(-1)}-${espnDay(1)}`;
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`espn ${r.status}`);
  return mapEspnScoreboard(await r.json());
}

// Cache-Control tuned for 50k concurrent viewers: 10s browser cache, 15s
// shared CDN cache with stale-while-revalidate so a burst hitting a cold
// isolate is served from Cloudflare instead of stampeding football-data.org.
const CDN_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=10, s-maxage=15, stale-while-revalidate=30",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const token = Deno.env.get("FOOTBALL_DATA_API_TOKEN");

  // 15s in-memory cache on the warm isolate (matches CDN s-maxage).
  if (cache && Date.now() - cache.at < 15_000) {
    return new Response(JSON.stringify(cache.body), {
      headers: { ...cors, "Content-Type": "application/json", ...CDN_CACHE_HEADERS },
    });
  }

  // Primary: ESPN. Keyless, World Cup-scoped, carries clock + goal events.
  try {
    const espn = await fetchEspn();
    if (espn.length > 0) {
      const body = {
        matches: sortMatches(espn),
        updated_at: new Date().toISOString(),
        source: "espn",
      };
      cache = { at: Date.now(), body };
      return new Response(JSON.stringify(body), {
        headers: { ...cors, "Content-Type": "application/json", ...CDN_CACHE_HEADERS },
      });
    }
  } catch (e) {
    console.error("espn source failed, falling back", (e as Error).message);
  }

  // Fallbacks below need the football-data token; without it ESPN was the only
  // shot, so report that rather than pretending there are no matches.
  if (!token) {
    return new Response(
      JSON.stringify({ error: "ESPN unavailable and FOOTBALL_DATA_API_TOKEN missing" }),
      {
        status: 502,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
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
      status: res.status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const raw = (await res.json()) as { matches: Array<Record<string, unknown>> };
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

  // Fallback: TheSportsDB free API for FIFA World Cup 2026 (league id 4429).
  if (matches.length === 0) {
    try {
      const endpoints = [
        "https://www.thesportsdb.com/api/v1/json/3/eventsseason.php?id=4429&s=2026",
        "https://www.thesportsdb.com/api/v1/json/3/eventspastleague.php?id=4429",
        "https://www.thesportsdb.com/api/v1/json/3/eventsnextleague.php?id=4429",
      ];
      const seen = new Set<string>();
      const merged: any[] = [];
      for (const u of endpoints) {
        const r = await fetch(u);
        if (!r.ok) continue;
        const j: any = await r.json();
        for (const e of j?.events ?? []) {
          if (!e?.idEvent || seen.has(e.idEvent)) continue;
          seen.add(e.idEvent);
          merged.push(e);
        }
      }
      const parseNum = (v: any) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      };
      /** Map TSDB status string to our internal status format */
      const statusFromTsdb = (s: string | null, progress: string | null): string => {
        const st = (s ?? "").toUpperCase();
        if (st === "FT" || st === "AET" || st === "PEN" || st === "MATCH FINISHED")
          return "FINISHED";
        if (st === "HT") return "PAUSED";
        if (progress && /\d/.test(progress)) return "IN_PLAY";
        if (st === "NS" || st === "" || st === "NOT STARTED") return "SCHEDULED";
        return "SCHEDULED";
      };
      matches = merged
        .map((e: any) => {
          const iso = e.strTimestamp
            ? new Date(e.strTimestamp + "Z").toISOString()
            : e.dateEvent
              ? new Date(`${e.dateEvent}T${e.strTime ?? "00:00:00"}Z`).toISOString()
              : null;
          return {
            id: Number(e.idEvent),
            competition: "FIFA World Cup",
            competition_code: "WC",
            stage: e.strSeason ? `WC ${e.strSeason}` : null,
            status: statusFromTsdb(e.strStatus, e.strProgress),
            minute: e.strProgress && /\d/.test(e.strProgress) ? parseInt(e.strProgress, 10) : null,
            injury_time: null,
            utc_date: iso,
            home: {
              name: e.strHomeTeam,
              tla: (e.strHomeTeam ?? "").slice(0, 3).toUpperCase(),
              crest: e.strHomeTeamBadge,
            },
            away: {
              name: e.strAwayTeam,
              tla: (e.strAwayTeam ?? "").slice(0, 3).toUpperCase(),
              crest: e.strAwayTeamBadge,
            },
            score: {
              full: { home: parseNum(e.intHomeScore), away: parseNum(e.intAwayScore) },
              half: { home: null, away: null },
            },
            live_source: "thesportsdb-wc2026",
          };
        })
        .filter((m: any) => m.utc_date)
        .sort((a: any, b: any) => a.utc_date.localeCompare(b.utc_date));
    } catch (e) {
      console.error("tsdb WC fallback failed", (e as Error).message);
    }
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

  const body = { matches: sortMatches(matches), updated_at: new Date().toISOString() };
  cache = { at: Date.now(), body };

  return new Response(JSON.stringify(body), {
    headers: { ...cors, "Content-Type": "application/json", ...CDN_CACHE_HEADERS },
  });
});
