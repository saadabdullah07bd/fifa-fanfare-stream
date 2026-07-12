// Runs before `vite dev` and `vite build`; writes public/sitemap.xml.
// Pulls dynamic match IDs and team names from Supabase so per-row routes are indexed.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = process.env.VITE_SITE_URL || "https://fifa-fanfare-stream.lovable.app";
const today = new Date().toISOString().slice(0, 10);

const staticEntries = [
  { path: "/", changefreq: "hourly", priority: "1.0", lastmod: today },
  { path: "/fixtures", changefreq: "hourly", priority: "0.9", lastmod: today },
  { path: "/standings", changefreq: "hourly", priority: "0.9", lastmod: today },
  { path: "/news", changefreq: "hourly", priority: "0.8", lastmod: today },
  { path: "/terms", changefreq: "yearly", priority: "0.2", lastmod: today },
  { path: "/privacy", changefreq: "yearly", priority: "0.2", lastmod: today },
];

/**
 * Fetches dynamic match entries from Supabase to include in the sitemap.
 * @returns Array of sitemap entries for dynamic match routes.
 */
async function fetchDynamic() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return [];
  try {
    const sb = createClient(url, key);
    const entries = [];

    const { data: matches } = await sb
      .from("matches")
      .select("external_id, id, date_utc")
      .limit(2000);
    for (const m of matches ?? []) {
      const id = (m.external_id ?? "").toString().replace(/^fd_/, "") || m.id;
      if (!id) continue;
      entries.push({
        path: `/match/${id}`,
        changefreq: "hourly",
        priority: "0.7",
        lastmod: (m.date_utc ?? "").slice(0, 10) || today,
      });
    }

    return entries;
  } catch {
    return [];
  }
}


/**
 * Generates the XML content for the sitemap.
 * @param entries - The list of sitemap entries.
 * @returns The full XML sitemap string.
 */
function generateSitemap(entries) {
  const urls = entries.map((e) =>
    [
      "  <url>",
      `    <loc>${BASE_URL}${e.path}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      "  </url>",
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
  ].join("\n");
}

const entries = [...staticEntries, ...(await fetchDynamic())];
writeFileSync(resolve("public/sitemap.xml"), generateSitemap(entries));
console.log(`sitemap.xml written (${entries.length} entries)`);
