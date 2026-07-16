/**
 * Live Matches Function
 * Purpose: Live and recent FIFA World Cup 2026 matches.
 * HTTP Method: GET
 * Outputs: JSON object with matches and last updated timestamp.
 * External APIs:
 *   - ESPN scoreboard JSON: the only source. Keyless, World Cup-scoped,
 *     real match clock, goal/card events in competitions[0].details.
 *
 * football-data.org and TheSportsDB fallbacks were removed 2026-07-16 along
 * with their API keys: both free tiers returned nothing for WC26, so they
 * only ever added latency and a secret to manage.
 *
 * Note: this used to also "enrich" scores/minutes via a Firecrawl web-search
 * text scrape and a Gemini prompt asking an LLM to invent a live score as
 * JSON. Both were removed — an LLM has no ground truth for a live score, and
 * regex-mining arbitrary search-result text for a "N-N" pattern will happily
 * match an unrelated article, prediction, or betting line. That combination
 * was the source of scores that didn't match reality (e.g. showing a result
 * for a match that hadn't kicked off yet). ESPN is a structured feed, NOT an
 * HTML scrape: do not replace it with one. A score here must always trace
 * back to a provider field — never to text matched out of a web page.
 */

import { ESPN_SCOREBOARD, espnDay, mapEspnScoreboard, sortMatches } from "../_shared/espn.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

let cache: { at: number; body: unknown } | null = null;

// Cache-Control tuned for 50k concurrent viewers: 10s browser cache, 15s
// shared CDN cache with stale-while-revalidate so a burst hitting a cold
// isolate is served from Cloudflare instead of stampeding the upstream feed.
const CDN_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=10, s-maxage=15, stale-while-revalidate=30",
};

/**
 * The `fifa.world` feed is World Cup-only, so no competition filtering is
 * needed. Range covers yesterday..tomorrow (UTC) so a match that kicked off
 * before UTC midnight is still returned while it is in play.
 */
async function fetchEspn(): Promise<any[]> {
  const url = `${ESPN_SCOREBOARD}?dates=${espnDay(-1)}-${espnDay(1)}`;
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`espn ${r.status}`);
  return mapEspnScoreboard(await r.json());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  // 15s in-memory cache on the warm isolate (matches CDN s-maxage).
  if (cache && Date.now() - cache.at < 15_000) {
    return new Response(JSON.stringify(cache.body), {
      headers: { ...cors, "Content-Type": "application/json", ...CDN_CACHE_HEADERS },
    });
  }

  try {
    const matches = await fetchEspn();
    const body = {
      matches: sortMatches(matches),
      updated_at: new Date().toISOString(),
      source: "espn",
    };
    cache = { at: Date.now(), body };
    return new Response(JSON.stringify(body), {
      headers: { ...cors, "Content-Type": "application/json", ...CDN_CACHE_HEADERS },
    });
  } catch (e) {
    // Serve the last good payload rather than an error if we have one — a
    // transient upstream blip should not blank the ticker for every viewer.
    if (cache) {
      return new Response(JSON.stringify(cache.body), {
        headers: { ...cors, "Content-Type": "application/json", ...CDN_CACHE_HEADERS },
      });
    }
    return new Response(JSON.stringify({ error: (e as Error).message, matches: [] }), {
      status: 502,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
