import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const DIST_DIR = join(process.cwd(), "dist");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const cleaned = normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  return join(DIST_DIR, cleaned);
}

async function fileExists(path) {
  try {
    const s = await stat(path);
    return s.isFile();
  } catch {
    return false;
  }
}

if (!existsSync(DIST_DIR)) {
  console.error("Missing ./dist. Run `npm run build` before starting.");
  process.exit(1);
}

createServer(async (req, res) => {
  const reqPath = req.url || "/";
  let target = safePath(reqPath === "/" ? "/index.html" : reqPath);
  let fallbackToIndex = false;
  const wantsFile = extname(reqPath.split("?")[0]) !== "";

  if (!(await fileExists(target))) {
    if (wantsFile) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
    fallbackToIndex = true;
    target = join(DIST_DIR, "index.html");
  }

  const type = MIME_TYPES[extname(target).toLowerCase()] || "application/octet-stream";
  res.setHeader("Content-Type", type);
  if (!fallbackToIndex) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  } else {
    res.setHeader("Cache-Control", "no-cache");
  }

  const stream = createReadStream(target);
  stream.on("error", () => {
    res.statusCode = 500;
    res.end("Server error");
  });
  stream.pipe(res);
}).listen(PORT, HOST, () => {
  console.log(`Pitch26 server listening on http://${HOST}:${PORT}`);
});
