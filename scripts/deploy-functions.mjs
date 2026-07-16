/**
 * Deploy edge functions to Supabase via Management API (uses SUPABASE_ACCESS_TOKEN).
 * Usage: node scripts/deploy-functions.mjs [fn...]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRef = "zdzmbqrbdiwyygxqnepv";
const defaultFns = [
  "xtream",
  "refresh-data",
  "push-goal-events",
  "push-final-results",
  "push-kickoff-reminders",
  "push-news-headlines",
];
const fns = process.argv.slice(2).length ? process.argv.slice(2) : defaultFns;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const collector = join(root, "scripts", "collect-function-files.mjs");

const verifyJwtOff = new Set([
  "xtream",
  "refresh-data",
  "push-goal-events",
  "push-final-results",
  "push-kickoff-reminders",
  "push-news-headlines",
  "live-matches",
  "news-feed",
  "standings",
  "client-config",
]);

for (const fn of fns) {
  console.log(`Deploying ${fn}...`);
  const files = JSON.parse(execSync(`node "${collector}" ${fn}`, { encoding: "utf8" }));
  const body = {
    name: fn,
    entrypoint_path: `${fn}/index.ts`,
    verify_jwt: !verifyJwtOff.has(fn),
    files,
  };
  const payload = join(root, ".deploy-payload.json");
  writeFileSync(payload, JSON.stringify(body));
  execSync(
    `npx supabase@latest functions deploy ${fn} --project-ref ${projectRef} --use-api --no-verify-jwt`,
    { cwd: root, stdio: "inherit", env: process.env },
  );
}
console.log("Done.");
