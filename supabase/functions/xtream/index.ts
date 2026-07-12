/**
 * Xtream Codes Proxy Function
 * Purpose: Manages Xtream Codes IPTV configuration, channel refreshing, and secure stream proxying.
 * HTTP Method: GET (proxy), POST (admin actions)
 * Inputs:
 *   - action: "get_config" | "save_config" | "refresh_channels" | "stream_url"
 *   - t: Security token for stream proxying (GET requests)
 * Outputs: JSON config/status or proxied binary video stream.
 * External APIs: Xtream Codes IPTV Panel (various hosts)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type XtreamConfig = { host: string; username: string; password: string };
type SignedPayload = { type: "stream" | "resource"; streamId: string; resource?: string; exp: number };

const STREAM_TTL_SECONDS = 30 * 60;

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Handle stream proxying (read-only GET with signed token)
    if (req.method === "GET") {
      return await handleStreamProxy(req, admin, serviceKey);
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    // Generate a signed URL for a specific channel stream
    if (action === "stream_url") {
      const streamId = String(body.streamId || "");
      if (!streamId) return json({ error: "streamId required" }, 400);
      const { data: channel } = await admin.from("channels").select("stream_id").eq("stream_id", streamId).maybeSingle();
      if (!channel) return json({ error: "Channel not found" }, 404);
      const { data: cfg } = await admin.from("xtream_config").select("id").eq("id", 1).maybeSingle();
      if (!cfg) return json({ error: "No Xtream config" }, 400);
      const edgeBase = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/xtream`;
      const t = await signPayload({ type: "stream", streamId, exp: expiresAt() }, serviceKey);
      return json({
        url: `${edgeBase}/stream/${encodeURIComponent(streamId)}.ts?t=${encodeURIComponent(t)}`,
        type: "mpegts",
        fallbackUrl: `${edgeBase}/stream/${encodeURIComponent(streamId)}.m3u8?t=${encodeURIComponent(t)}`,
      });
    }

    // Verify user session for admin actions
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Not signed in" }, 401);

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) return json({ error: "Invalid session" }, 401);
    const userId = userData.user.id;

    // Check admin role
    const { data: isAdminData } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
    const isAdmin = !!isAdminData;

    // Admin: Fetch current configuration (sanitized)
    if (action === "get_config") {
      if (!isAdmin) return json({ error: "Admin only" }, 403);
      const { data } = await admin.from("xtream_config").select("host, username, updated_at").eq("id", 1).maybeSingle();
      return json(data);
    }

    // Admin: Save new Xtream configuration
    if (action === "save_config") {
      if (!isAdmin) return json({ error: "Admin only" }, 403);
      const host = String(body.host || "").replace(/\/$/, "");
      const username = String(body.username || "");
      const password = String(body.password || "");
      if (!/^https?:\/\//.test(host) || !username || !password) return json({ error: "Invalid input" }, 400);
      const { error } = await admin.from("xtream_config").upsert({ id: 1, host, username, password, updated_at: new Date().toISOString() });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    // Admin: Fetch categories/streams from upstream and sync to local DB
    if (action === "refresh_channels") {
      if (!isAdmin) return json({ error: "Admin only" }, 403);
      const { data: cfg } = await admin.from("xtream_config").select("*").eq("id", 1).maybeSingle();
      if (!cfg) return json({ error: "No Xtream config saved" }, 400);
      const base = `${cfg.host}/player_api.php?username=${encodeURIComponent(cfg.username)}&password=${encodeURIComponent(cfg.password)}`;
      const catsRes = await fetch(`${base}&action=get_live_categories`);
      if (!catsRes.ok) return json({ error: `Xtream categories failed [${catsRes.status}]` }, 502);
      const cats = await catsRes.json() as Array<{ category_id: string; category_name: string }>;
      
      const wcRe = /world.?cup|fifa|wc.?2026|coupe.?du.?monde|mundial/i;
      const excludeRe = /bein/i;
      const crRe = /cricket|ipl|t20|test match/i;
      const wanted = cats
        .map((c) => ({ id: c.category_id, name: c.category_name,
          category: excludeRe.test(c.category_name) ? null : (wcRe.test(c.category_name) ? "wc2026" : crRe.test(c.category_name) ? "cricket" : null) }))
        .filter((c) => c.category !== null) as Array<{ id: string; name: string; category: "wc2026" | "cricket" }>;

      await admin.from("channels").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      let total = 0;
      for (const cat of wanted) {
        const sRes = await fetch(`${base}&action=get_live_streams&category_id=${cat.id}`);
        if (!sRes.ok) continue;
        const streams = await sRes.json() as Array<{ stream_id: number | string; name: string; stream_icon?: string; epg_channel_id?: string }>;
        const rows = streams.map((s) => ({
          category: cat.category, stream_id: String(s.stream_id), name: s.name,
          logo_url: s.stream_icon ?? null, epg_channel_id: s.epg_channel_id ?? null,
        }));
        if (rows.length) {
          await admin.from("channels").upsert(rows, { onConflict: "category,stream_id" });
          total += rows.length;
        }
      }
      return json({ ok: true, categories: wanted.length, channels: total });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

/** Helper for JSON responses */
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

/** Routes and validates stream proxy requests */
async function handleStreamProxy(req: Request, admin: ReturnType<typeof createClient>, secret: string) {
  const requestUrl = new URL(req.url);
  const path = requestUrl.pathname;
  const edgeBase = `${requestUrl.origin}/functions/v1/xtream`;

  // Main stream entry point (.m3u8 or .ts)
  const streamMatch = path.match(/\/xtream\/stream\/([^/]+)\.(m3u8|ts)$/);
  if (streamMatch) {
    const streamId = decodeURIComponent(streamMatch[1]);
    const ext = streamMatch[2];
    const payload = await verifyPayload(requestUrl.searchParams.get("t") ?? "", secret);
    if (!payload || payload.type !== "stream" || payload.streamId !== streamId) return json({ error: "Invalid stream link" }, 403);

    const cfg = await getConfig(admin);
    if (!cfg) return json({ error: "No Xtream config" }, 400);
    const upstreamUrl = buildUpstreamUrl(cfg, `${streamId}.${ext}`);
    return await proxyUpstream(req, cfg, streamId, upstreamUrl, edgeBase, secret);
  }

  // Nested resources (playlist segments)
  if (path.endsWith("/xtream/resource")) {
    const streamId = requestUrl.searchParams.get("streamId") ?? "";
    const resource = requestUrl.searchParams.get("resource") ?? "";
    const payload = await verifyPayload(requestUrl.searchParams.get("t") ?? "", secret);
    if (!payload || payload.type !== "resource" || payload.streamId !== streamId || payload.resource !== resource) {
      return json({ error: "Invalid stream link" }, 403);
    }
    if (!isSafeResource(resource)) return json({ error: "Invalid stream resource" }, 400);

    const cfg = await getConfig(admin);
    if (!cfg) return json({ error: "No Xtream config" }, 400);
    return await proxyUpstream(req, cfg, streamId, buildUpstreamUrl(cfg, resource), edgeBase, secret);
  }

  return json({ error: "Unknown stream route" }, 404);
}

/** Fetches configuration from database */
async function getConfig(admin: ReturnType<typeof createClient>): Promise<XtreamConfig | null> {
  const { data } = await admin.from("xtream_config").select("host, username, password").eq("id", 1).maybeSingle();
  return data as XtreamConfig | null;
}

/** Proxies request to upstream server and rewrites playlists if necessary */
async function proxyUpstream(req: Request, cfg: XtreamConfig, streamId: string, upstreamUrl: string, edgeBase: string, secret: string) {
  const headers = new Headers();
  const range = req.headers.get("range");
  if (range) headers.set("range", range);

  const upstream = await fetch(upstreamUrl, { headers });
  if (!upstream.ok || !upstream.body) return json({ error: `Stream upstream failed [${upstream.status}]` }, 502);

  const contentType = upstream.headers.get("content-type") ?? "";
  if (isPlaylist(upstreamUrl, contentType)) {
    const text = await upstream.text();
    const playlist = await rewritePlaylist(text, upstreamUrl, cfg, streamId, edgeBase, secret);
    return new Response(playlist, {
      status: upstream.status,
      headers: { ...cors, "Content-Type": "application/vnd.apple.mpegurl", "Cache-Control": "no-store" },
    });
  }

  const responseHeaders = new Headers(cors);
  for (const header of ["content-type", "content-length", "content-range", "accept-ranges", "cache-control"] as const) {
    const value = upstream.headers.get(header);
    if (value) responseHeaders.set(header, value);
  }
  if (!responseHeaders.has("content-type")) responseHeaders.set("content-type", "video/mp2t");
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

/** Checks if a response is an HLS playlist */
function isPlaylist(url: string, contentType: string) {
  return /mpegurl|application\/vnd\.apple/i.test(contentType) || new URL(url).pathname.endsWith(".m3u8");
}

/** Rewrites upstream .m3u8 playlists to route segments through this function */
async function rewritePlaylist(text: string, playlistUrl: string, cfg: XtreamConfig, streamId: string, edgeBase: string, secret: string) {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { out.push(line); continue; }

    if (trimmed.startsWith("#")) {
      const uriMatch = line.match(/URI="([^"]+)"/);
      if (!uriMatch) { out.push(line); continue; }
      const resource = extractResource(uriMatch[1], playlistUrl, cfg);
      if (!resource) { out.push(line); continue; }
      out.push(line.replace(uriMatch[1], await signedResourceUrl(edgeBase, streamId, resource, secret)));
      continue;
    }

    const resource = extractResource(trimmed, playlistUrl, cfg);
    out.push(resource ? await signedResourceUrl(edgeBase, streamId, resource, secret) : line);
  }
  return out.join("\n");
}

/** Extracts the resource path from an upstream URL */
function extractResource(lineUrl: string, playlistUrl: string, cfg: XtreamConfig) {
  const resolved = new URL(lineUrl, playlistUrl);
  const parts = resolved.pathname.split("/").map((p) => decodeURIComponent(p));
  const credentialsAt = parts.findIndex((p, i) => p === cfg.username && parts[i + 1] === cfg.password);
  const resourceParts = credentialsAt >= 0
    ? parts.slice(credentialsAt + 2)
    : parts.filter(Boolean).slice(-1);
  if (!resourceParts.length) return null;
  const resource = resourceParts.map(encodeURIComponent).join("/") + resolved.search;
  return isSafeResource(resource) ? resource : null;
}

/** Rebuilds the upstream URL using saved credentials */
function buildUpstreamUrl(cfg: XtreamConfig, resource: string) {
  const queryAt = resource.indexOf("?");
  const path = queryAt >= 0 ? resource.slice(0, queryAt) : resource;
  const query = queryAt >= 0 ? resource.slice(queryAt) : "";
  const encodedPath = path.split("/").filter(Boolean).map((part) => encodeURIComponent(decodeURIComponent(part))).join("/");
  return `${cfg.host}/live/${encodeURIComponent(cfg.username)}/${encodeURIComponent(cfg.password)}/${encodedPath}${query}`;
}

/** Security check to prevent open proxy exploitation */
function isSafeResource(resource: string) {
  const path = resource.split("?")[0];
  return !!path && !resource.includes("://") && !path.startsWith("/") && !path.split("/").some((part) => part === ".." || part === "");
}

/** Generates a signed local URL for a nested stream resource */
async function signedResourceUrl(edgeBase: string, streamId: string, resource: string, secret: string) {
  const t = await signPayload({ type: "resource", streamId, resource, exp: expiresAt() }, secret);
  return `${edgeBase}/resource?streamId=${encodeURIComponent(streamId)}&resource=${encodeURIComponent(resource)}&t=${encodeURIComponent(t)}`;
}

/** Returns expiration timestamp for tokens */
function expiresAt() {
  return Math.floor(Date.now() / 1000) + STREAM_TTL_SECONDS;
}

/** Signs a payload using HMAC SHA-256 */
async function signPayload(payload: SignedPayload, secret: string) {
  const body = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await hmac(body, secret);
  return `${body}.${signature}`;
}

/** Verifies a signed token and its expiration */
async function verifyPayload(token: string, secret: string): Promise<SignedPayload | null> {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = await hmac(body, secret);
  if (!timingSafeEqual(signature, expected)) return null;
  const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(body))) as SignedPayload;
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

/** HMAC calculation */
async function hmac(message: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return base64UrlEncode(new Uint8Array(sig));
}

/** URL-safe Base64 encoding */
function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/** URL-safe Base64 decoding */
function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** Constant-time string comparison */
function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}
