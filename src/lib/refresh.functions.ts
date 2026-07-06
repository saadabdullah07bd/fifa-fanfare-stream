import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Server-only refresh functions. Each scrape best-effort — never throw across RPC.
export const refreshAll = createServerFn({ method: "POST" }).handler(async () => {
  const { firecrawlScrape } = await import("./firecrawl.server");
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const results: Record<string, string> = {};

  async function record(source: string, status: string, detail?: string) {
    await sb.from("scrape_runs").upsert({ source, status, detail, last_run_at: new Date().toISOString() });
    results[source] = status + (detail ? `: ${detail}` : "");
  }

  // 1) Fixtures / results from Wikipedia
  try {
    const res = await firecrawlScrape(
      "https://en.wikipedia.org/wiki/2026_FIFA_World_Cup",
      ["markdown"],
    );
    const md = res.markdown ?? "";
    // Parse lines like "10 June 2026 – USA vs Mexico – 2–1" (best-effort)
    const matchRe =
      /(\d{1,2}\s+\w+\s+2026)[^\n]{0,80}?([A-Z][A-Za-z ]{2,20})\s+(?:vs\.?|v)\s+([A-Z][A-Za-z ]{2,20})(?:[^\n]{0,40}?(\d)\s*[–-]\s*(\d))?/g;
    let match;
    let inserted = 0;
    while ((match = matchRe.exec(md)) && inserted < 30) {
      const [_, dateStr, home, away, hs, as] = match;
      const date = new Date(dateStr + " UTC");
      if (isNaN(date.getTime())) continue;
      const externalId = `${date.toISOString().slice(0, 10)}_${home}_${away}`.replace(/\s+/g, "_");
      await sb.from("matches").upsert(
        {
          external_id: externalId,
          stage: "group",
          date_utc: date.toISOString(),
          home_team_code: null,
          away_team_code: null,
          home_score: hs ? parseInt(hs) : null,
          away_score: as ? parseInt(as) : null,
          status: hs ? "ft" : "scheduled",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "external_id" },
      );
      inserted++;
    }
    await record("fixtures", "ok", `${inserted} matches parsed`);
  } catch (e) {
    await record("fixtures", "error", String((e as Error).message).slice(0, 200));
  }

  // 2) News headlines via Firecrawl search
  try {
    const { firecrawlSearch } = await import("./firecrawl.server");
    const results = await firecrawlSearch("FIFA World Cup 2026 news", 10);
    for (const r of results) {
      await sb.from("news").upsert(
        {
          url: r.url,
          title: r.title,
          summary: r.description ?? null,
          source: new URL(r.url).hostname.replace(/^www\./, ""),
          published_at: new Date().toISOString(),
        },
        { onConflict: "url" },
      );
    }
    await record("news", "ok", `${results.length} items`);
  } catch (e) {
    await record("news", "error", String((e as Error).message).slice(0, 200));
  }

  return results;
});

export const refreshLiveMatches = createServerFn({ method: "POST" }).handler(async () => {
  // Placeholder: bumps live-match scoreline scraping. Real live source can be wired later.
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  await sb.from("scrape_runs").upsert({
    source: "live",
    status: "ok",
    detail: "poll",
    last_run_at: new Date().toISOString(),
  });
  return { ok: true };
});

export const triggerRefresh = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({}).parse(d ?? {}))
  .handler(async () => {
    return refreshAll();
  });
