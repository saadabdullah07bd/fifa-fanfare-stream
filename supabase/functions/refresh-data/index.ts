/**
 * Data Refresh Function
 * Purpose: Synchronizes football data (teams, matches, standings, scorers, news) from external APIs to the Supabase database.
 * HTTP Method: POST (Authorized via CRON_SECRET or Supabase Anon Key)
 * Inputs:
 *   - mode: "full" (all data) | "matches" (only match updates).
 * Outputs: JSON summary of sync results for each data type.
 * External APIs:
 *   - NewsAPI: Tournament news articles.
 *
 * football-data.org sync (teams/matches/standings/scorers) was removed
 * 2026-07-16 with its API key: the free tier carried no WC26 data, so every
 * sync row it wrote was empty or stale. Match data now lives in the bundled
 * wc26-matches.json and the ESPN-backed live-matches function.
 * Auth: Verified against environment CRON_SECRET or bearer tokens.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req) => {
  // CORS Preflight
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  // Authorization: only the scheduled-job secret can trigger a refresh.
  // Previously any request bearing the public anon key was accepted, which
  // meant anyone on the internet could force a full sync (blowing external-
  // API quotas and DB churn). CRON_SECRET is server-only.
  const expected = Deno.env.get("CRON_SECRET");
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const cronHeader = req.headers.get("x-cron-secret") ?? "";

  const authorized = !!expected && (cronHeader === expected || bearer === expected);

  if (!authorized) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Admin client with service role for DB writes
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    {
      auth: { persistSession: false },
    },
  );
  const results: Record<string, string> = {};
  const now = new Date().toISOString();

  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") ?? "full";

  /** Logs the result of a specific sync operation to the database */
  async function record(source: string, status: string, detail?: string) {
    await admin
      .from("scrape_runs")
      .upsert({ source, status, detail: detail ?? null, last_run_at: now });
    results[source] = status + (detail ? `: ${detail}` : "");
  }

  const newsKey = Deno.env.get("NEWSAPI_KEY");

  // ---- NewsAPI (skip in matches-only mode) ----
  if (mode !== "matches") {
    if (newsKey) {
      try {
        const newsUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent("FIFA World Cup 2026")}&sortBy=publishedAt&language=en&pageSize=30&apiKey=${newsKey}`;
        const res = await fetch(newsUrl);
        if (res.ok) {
          const { articles } = (await res.json()) as { articles: Array<any> };
          const newsRows = articles
            .filter((a) => !!a.url && !!a.title)
            .map((a) => ({
              url: a.url,
              title: a.title,
              summary: a.description ?? null,
              source: a.source?.name ?? new URL(a.url).hostname.replace(/^www\./, ""),
              image_url: a.urlToImage ?? null,
              published_at: a.publishedAt ?? now,
            }));
          if (newsRows.length) await admin.from("news").upsert(newsRows, { onConflict: "url" });
          await record("news", "ok", `${articles.length} items`);
        } else await record("news", "error", `HTTP ${res.status}`);
      } catch (e) {
        await record("news", "error", (e as Error).message.slice(0, 200));
      }
    } else {
      await record("news", "skipped", "NEWSAPI_KEY not set");
    }
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
