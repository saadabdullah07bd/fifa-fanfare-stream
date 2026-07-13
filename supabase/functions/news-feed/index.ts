/**
 * News Feed Function
 * Purpose: Provides a live news feed focused on the FIFA World Cup 2026.
 * HTTP Method: GET
 * Inputs:
 *   - q: Optional search query (overrides default World Cup query).
 * Outputs: JSON object with de-duplicated articles and source attribution.
 * External APIs:
 *   - NewsAPI.org: Primary source for structured news with images.
 *   - Google News RSS: Fallback source for latest headlines.
 */

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const cache = new Map<string, { at: number; body: unknown }>();
const CACHE_MS = 3600_000; // 1 hour

/** Removes HTML tags and normalizes entities in news summaries */
function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/https?:\/\/\S+/g, "") // drop raw URLs
    .replace(/\[\+\d+\s*chars?\]/gi, "")
    .trim();
}

/** Extracts text content from specific XML tags in RSS feeds */
function pick(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  if (!m) return "";
  return m[1].replace(/^<!\[CDATA\[|\]\]>$/g, "").trim();
}

/** Fetches articles from NewsAPI.org */
async function fromNewsApi(q: string): Promise<any[] | null> {
  const key = Deno.env.get("NEWSAPI_KEY");
  if (!key) return null;
  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&language=en&sortBy=publishedAt&pageSize=30`;
  const r = await fetch(url, { headers: { "X-Api-Key": key, "User-Agent": "Pitch26/1.0" } });
  if (!r.ok) {
    console.error("newsapi error", r.status, await r.text());
    return null;
  }
  const j = await r.json().catch(() => null);
  if (!j || j.status !== "ok" || !Array.isArray(j.articles)) {
    console.error("newsapi bad body", JSON.stringify(j).slice(0, 200));
    return null;
  }
  return j.articles
    .filter((a: any) => a.title && a.url && !/^\[Removed\]/.test(a.title))
    .map((a: any, i: number) => ({
      id: `n-${i}-${a.url}`,
      title:
        stripHtml(a.title)
          .replace(/\s*-\s*[^-]+$/, "")
          .trim() || stripHtml(a.title),
      url: a.url,
      source: a.source?.name ?? "News",
      summary: stripHtml(a.description ?? a.content ?? "").slice(0, 260),
      image_url: a.urlToImage ?? null,
      published_at: a.publishedAt ?? null,
    }));
}

/** Fetches articles from Google News RSS as a fallback */
async function fromGoogleRss(q: string): Promise<any[]> {
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
  const res = await fetch(rssUrl, { headers: { "User-Agent": "Pitch26/1.0" } });
  if (!res.ok) return [];
  const xml = await res.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 24).map((m, i) => {
    const it = m[1];
    return {
      id: `g-${i}`,
      title: stripHtml(pick(it, "title"))
        .replace(/\s*-\s*[^-]+$/, "")
        .trim(),
      url: pick(it, "link"),
      source: pick(it, "source") || "Google News",
      summary: "", // Google RSS descriptions are just link lists
      image_url: null,
      published_at: pick(it, "pubDate") ? new Date(pick(it, "pubDate")).toISOString() : null,
    };
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? '"World Cup 2026" OR "FIFA World Cup 2026"';

  const CDN = {
    "Cache-Control": "public, max-age=300, s-maxage=600, stale-while-revalidate=1800",
  };

  const hit = cache.get(q);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return new Response(JSON.stringify(hit.body), {
      headers: { ...cors, "Content-Type": "application/json", ...CDN },
    });
  }

  let articles = (await fromNewsApi(q)) ?? [];
  let source: "newsapi" | "google" = "newsapi";
  if (articles.length === 0) {
    articles = await fromGoogleRss(q);
    source = "google";
  }

  // De-duplicate by URL and by normalized title
  const seenUrl = new Set<string>();
  const seenTitle = new Set<string>();
  articles = articles.filter((a: any) => {
    const u = (a.url || "").split("?")[0].toLowerCase();
    const t = (a.title || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(" ")
      .slice(0, 8)
      .join(" ");
    if (!u || !t) return false;
    if (seenUrl.has(u) || seenTitle.has(t)) return false;
    seenUrl.add(u);
    seenTitle.add(t);
    return true;
  });

  const body = { articles, source, updated_at: new Date().toISOString() };
  cache.set(q, { at: Date.now(), body });
  return new Response(JSON.stringify(body), {
    headers: { ...cors, "Content-Type": "application/json", ...CDN },
  });
});
