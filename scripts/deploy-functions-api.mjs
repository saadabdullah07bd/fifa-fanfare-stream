/**
 * Deploy edge functions using Supabase Management API.
 * Requires SUPABASE_ACCESS_TOKEN in environment (from `supabase login`).
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const projectRef = "zdzmbqrbdiwyygxqnepv";
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("SUPABASE_ACCESS_TOKEN is required. Run: npx supabase login");
  process.exit(1);
}

const fns = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      "refresh-data",
      "push-news-headlines",
      "push-kickoff-reminders",
      "push-final-results",
      "push-goal-events",
      "xtream",
    ];

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const collector = join(root, "scripts", "collect-function-files.mjs");

for (const name of fns) {
  const files = JSON.parse(execSync(`node "${collector}" ${name}`, { encoding: "utf8" }));
  const body = {
    name,
    entrypoint_path: `${name}/index.ts`,
    verify_jwt: false,
    files,
  };
  console.log(`Deploying ${name} (${files.length} files)...`);
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/functions/deploy`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Failed ${name}: ${res.status} ${text}`);
    process.exit(1);
  }
  console.log(`OK ${name}:`, text.slice(0, 200));
}
console.log("All functions deployed.");
