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

async function fetchDynamic() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return [];
  try {
    const sb = createClient(url, key);
    const entries = [];

    const { data: matches } = await sb
      .from("matches")
      .select("external_id, id, utc_date")
      .limit(2000);
    for (const m of matches ?? []) {
      const id = (m.external_id ?? "").toString().replace(/^fd_/, "") || m.id;
      if (!id) continue;
      entries.push({
        path: `/match/${id}`,
        changefreq: "hourly",
        priority: "0.7",
        lastmod: today,
      });
    }

    const { data: teams } = await sb
      .from("matches")
      .select("home_team_name, away_team_name")
      .limit(2000);
    const teamNames = new Set();
    for (const t of teams ?? []) {
      if (t.home_team_name) teamNames.add(t.home_team_name);
      if (t.away_team_name) teamNames.add(t.away_team_name);
    }
    for (const name of teamNames) {
      entries.push({
        path: `/team/${encodeURIComponent(name)}`,
        changefreq: "weekly",
        priority: "0.5",
        lastmod: today,
      });
    }

    return entries;
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
