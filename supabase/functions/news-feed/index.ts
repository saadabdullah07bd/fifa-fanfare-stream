// Live news feed via Google News RSS with best-effort og:image enrichment.
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

async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3500);
    const r = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 Pitch26Bot" },
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const html = (await r.text()).slice(0, 200_000);
    const m =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    return m ? m[1] : null;
  } catch {
    return null;
  }
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

  const rawItems = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 24).map((m, i) => {
    const it = m[1];
    const descHtml = pick(it, "description");
    return {
      id: `${i}`,
      title: stripHtml(pick(it, "title")),
      url: pick(it, "link"),
      source: pick(it, "source") || "Google News",
      summary: stripHtml(descHtml).slice(0, 240),
      image_url: (descHtml.match(/<img[^>]+src="([^"]+)"/i)?.[1]) ?? null,
      published_at: pick(it, "pubDate") ? new Date(pick(it, "pubDate")).toISOString() : null,
    };
  });

  // Enrich missing images in parallel (best-effort).
  const enriched = await Promise.all(rawItems.map(async (a) => {
    if (a.image_url) return a;
    const img = await fetchOgImage(a.url);
    return { ...a, image_url: img };
  }));

  const body = { articles: enriched, updated_at: new Date().toISOString() };
  cache = { at: Date.now(), body };
  return new Response(JSON.stringify(body), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
