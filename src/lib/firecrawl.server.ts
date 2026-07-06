// Server-only Firecrawl helper. Do NOT import from client-reachable files.
const FIRECRAWL_BASE = "https://api.firecrawl.dev/v2";

export type FirecrawlScrapeResult = {
  markdown?: string;
  html?: string;
  links?: string[];
  metadata?: { title?: string; description?: string; sourceURL?: string };
  json?: unknown;
};

function apiKey() {
  const k = process.env.FIRECRAWL_API_KEY;
  if (!k) throw new Error("FIRECRAWL_API_KEY not configured");
  return k;
}

export async function firecrawlScrape(
  url: string,
  formats: Array<string | Record<string, unknown>> = ["markdown", "links"],
): Promise<FirecrawlScrapeResult> {
  const res = await fetch(`${FIRECRAWL_BASE}/scrape`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({ url, formats, onlyMainContent: true }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firecrawl scrape failed [${res.status}]: ${text}`);
  }
  const json = (await res.json()) as { data?: FirecrawlScrapeResult } & FirecrawlScrapeResult;
  return json.data ?? json;
}

export async function firecrawlSearch(query: string, limit = 10) {
  const res = await fetch(`${FIRECRAWL_BASE}/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({ query, limit }),
  });
  if (!res.ok) throw new Error(`Firecrawl search failed [${res.status}]`);
  const json = (await res.json()) as {
    data?: Array<{ url: string; title: string; description?: string }>;
  };
  return json.data ?? [];
}
