// Runs before `vite dev` and `vite build`; writes public/sitemap.xml.
// Pulls dynamic venue IDs from Supabase so /venues/:id routes are indexed.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = process.env.VITE_SITE_URL || "https://pitch26.drmabari.com";

const today = new Date().toISOString().slice(0, 10);

const staticEntries = [
  { path: "/", changefreq: "hourly", priority: "1.0", lastmod: today },
  { path: "/fixtures", changefreq: "hourly", priority: "0.9", lastmod: today },
  { path: "/groups", changefreq: "hourly", priority: "0.9", lastmod: today },
  { path: "/teams", changefreq: "daily", priority: "0.8", lastmod: today },
  { path: "/scorers", changefreq: "hourly", priority: "0.8", lastmod: today },
  { path: "/venues", changefreq: "weekly", priority: "0.8", lastmod: today },
  { path: "/news", changefreq: "hourly", priority: "0.7", lastmod: today },
  { path: "/highlights", changefreq: "daily", priority: "0.7", lastmod: today },
  { path: "/predictions", changefreq: "weekly", priority: "0.5", lastmod: today },
];

async function fetchDynamic() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return [];
  try {
    const sb = createClient(url, key);
    const { data } = await sb.from("venues").select("id");
    return (data ?? []).map((v) => ({
      path: `/venues/${v.id}`,
      changefreq: "monthly",
      priority: "0.6",
      lastmod: today,
    }));
  } catch {
    return [];
  }
}

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
