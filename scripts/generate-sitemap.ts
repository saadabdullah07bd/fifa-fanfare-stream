// Runs before `vite dev` and `vite build`; writes public/sitemap.xml.
// Pulls dynamic venue IDs from Supabase so /venues/:id routes are indexed.

import { writeFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// TODO: replace with your project URL once a custom domain is set on Hostinger.
const BASE_URL = "";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const today = new Date().toISOString().slice(0, 10);

const staticEntries: SitemapEntry[] = [
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

async function fetchDynamic(): Promise<SitemapEntry[]> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return [];
  try {
    const sb = createClient(url, key);
    const { data } = await sb.from("venues").select("id");
    return (data ?? []).map((v) => ({
      path: `/venues/${v.id}`,
      changefreq: "monthly" as const,
      priority: "0.6",
      lastmod: today,
    }));
  } catch {
    return [];
  }
}

function generateSitemap(entries: SitemapEntry[]) {
  const urls = entries.map((e) =>
    [
      `  <url>`,
      `    <loc>${BASE_URL}${e.path}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}

const entries = [...staticEntries, ...(await fetchDynamic())];
writeFileSync(resolve("public/sitemap.xml"), generateSitemap(entries));
console.log(`sitemap.xml written (${entries.length} entries)`);
