/**
 * Collects edge function source files for Supabase deploy.
 * Usage: node scripts/collect-function-files.mjs <function-name>
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const fn = process.argv[2];
if (!fn) {
  console.error("Usage: node scripts/collect-function-files.mjs <function-name>");
  process.exit(1);
}

const functionsRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "functions");
const entry = join(functionsRoot, fn, "index.ts");
if (!existsSync(entry)) {
  console.error(`Missing ${entry}`);
  process.exit(1);
}

const files = new Map();

function deployName(absPath) {
  return absPath.replace(functionsRoot + "\\", "").replace(functionsRoot + "/", "").replace(/\\/g, "/");
}

function add(absPath) {
  if (!existsSync(absPath) || files.has(absPath)) return;
  files.set(absPath, readFileSync(absPath, "utf8"));
}

function collectImports(tsPath) {
  add(tsPath);
  const src = readFileSync(tsPath, "utf8");
  for (const m of src.matchAll(/from\s+["'](\.\.?\/[^"']+)["']/g)) {
    const rel = m[1];
    const base = resolve(dirname(tsPath), rel);
    const candidates = [
      base,
      `${base}.ts`,
      join(base, "index.ts"),
      `${base}.json`,
    ];
    for (const c of candidates) {
      if (existsSync(c)) {
        add(c);
        if (c.endsWith(".ts")) collectImports(c);
        break;
      }
    }
  }
}

collectImports(entry);

const out = [...files.entries()].map(([abs, content]) => ({
  name: deployName(abs),
  content,
}));
process.stdout.write(JSON.stringify(out));
