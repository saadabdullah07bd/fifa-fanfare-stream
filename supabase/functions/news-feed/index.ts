// Live news feed via Google News RSS — no API key, works from anywhere,
// always fresh. Cached 5 minutes in-memory to avoid hammering.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

let cache: { at: number; body: unknown } | null = null;

function pick(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  if (!m) return "";
  return m[1].replace(/^<!\[CDATA\[|\]\]>$/g, "").trim();
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "FIFA World Cup 2026 OR football soccer";

  if (cache && Date.now() - cache.at < 300_000) {
    return new Response(JSON.stringify(cache.body), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
  const res = await fetch(rssUrl, { headers: { "User-Agent": "Pitch26/1.0" } });
  if (!res.ok) {
    return new Response(JSON.stringify({ error: `rss ${res.status}`, articles: [] }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const xml = await res.text();

  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 40).map((m, i) => {
    const it = m[1];
    const title = stripHtml(pick(it, "title"));
    const link = pick(it, "link");
    const pubDate = pick(it, "pubDate");
    const source = pick(it, "source");
    const descHtml = pick(it, "description");
    const imgMatch = descHtml.match(/<img[^>]+src="([^"]+)"/i);
    return {
      id: `${i}-${link}`,
      title,
      url: link,
      source: source || "Google News",
      summary: stripHtml(descHtml).slice(0, 240),
      image_url: imgMatch ? imgMatch[1] : null,
      published_at: pubDate ? new Date(pubDate).toISOString() : null,
    };
  });

  const body = { articles: items, updated_at: new Date().toISOString() };
  cache = { at: Date.now(), body };
  return new Response(JSON.stringify(body), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
