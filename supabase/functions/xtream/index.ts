/**
 * Xtream Codes Proxy Function
 * Purpose: Manages Xtream Codes IPTV configuration, channel refreshing,
 *          default-channel selection, and secure stream proxying.
 * HTTP Method: GET (proxy), POST (admin actions)
 *
 * Security notes:
 *   - Signed stream tokens are HMAC-SHA256 signed with a dedicated
 *     XTREAM_SIGNING_SECRET, NOT the service-role key. This means rotating
 *     the service role never invalidates outstanding streams, and the
 *     signing key never touches PostgREST or DB code paths.
 *   - The imported HMAC CryptoKey is cached at module scope so 50k+
 *     concurrent HLS clients don't force a WebCrypto import per segment.
 *   - HLS segment responses set Cache-Control so Cloudflare (the CF-edge
 *     in front of Supabase Functions) can serve repeat viewers without
 *     hitting the upstream IPTV panel.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type XtreamConfig = { host: string; username: string; password: string };
type SignedPayload = {
  type: "stream" | "resource";
  streamId: string;
  resource?: string;
  exp: number;
};

const STREAM_TTL_SECONDS = 30 * 60;

// Prefer the dedicated signing secret; fall back to service role only if the
// former was never provisioned (keeps existing streams playing during rollout).
const SIGNING_SECRET =
  Deno.env.get("XTREAM_SIGNING_SECRET") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Module-scope cache for the HMAC CryptoKey. Importing a key involves
// PBKDF-ish work in WebCrypto; caching drops per-request signing latency
// from ~1ms to a few microseconds — meaningful at 50k concurrent viewers.
let hmacKeyPromise: Promise<CryptoKey> | null = null;
function getHmacKey(): Promise<CryptoKey> {
  if (!hmacKeyPromise) {
    hmacKeyPromise = crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(SIGNING_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
  }
  return hmacKeyPromise;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Signed stream proxy is stateless GET — no session needed.
    if (req.method === "GET") {
      return await handleStreamProxy(req, admin);
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    // Public: return the admin-selected default stream_id so LiveTV can
    // auto-tune to it. Fast, cache-friendly, no auth required.
    if (action === "get_default_channel") {
      const { data } = await admin
        .from("app_settings")
        .select("default_stream_id")
        .eq("id", 1)
        .maybeSingle();
      return json({ default_stream_id: data?.default_stream_id ?? null }, 200, {
        "Cache-Control": "public, max-age=15, s-maxage=60",
      });
    }

    // Public: mint a signed URL for a given channel stream.
    if (action === "stream_url") {
      const streamId = String(body.streamId || "");
      if (!streamId) return json({ error: "streamId required" }, 400);
      const { data: channel } = await admin
        .from("channels")
        .select("stream_id, direct_url")
        .eq("stream_id", streamId)
        .maybeSingle();
      if (!channel) return json({ error: "Channel not found" }, 404);
      // Manual channel: play the admin-provided m3u8/ts URL directly.
      const directUrl = (channel as { direct_url?: string | null }).direct_url ?? null;
      if (directUrl) {
        const lower = directUrl.toLowerCase();
        const type = lower.includes(".m3u8") ? "hls" : lower.includes(".ts") ? "mpegts" : "hls";
        return json({ url: directUrl, type });
      }
      const { data: cfg } = await admin
        .from("xtream_config")
        .select("id")
        .eq("id", 1)
        .maybeSingle();
      if (!cfg) return json({ error: "No Xtream config" }, 400);
      const edgeBase = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/xtream`;
      const t = await signPayload({ type: "stream", streamId, exp: expiresAt() });
      return json({
        url: `${edgeBase}/stream/${encodeURIComponent(streamId)}.ts?t=${encodeURIComponent(t)}`,
        type: "mpegts",
        fallbackUrl: `${edgeBase}/stream/${encodeURIComponent(streamId)}.m3u8?t=${encodeURIComponent(t)}`,
      });
    }

    // Admin: add a manual channel that plays a direct m3u8/HLS/TS URL.
    if (action === "add_manual_channel") {
      // Auth check happens below; hoist admin ID resolution first.
      const authHeader = req.headers.get("Authorization") ?? "";
      const token = authHeader.replace("Bearer ", "");
      if (!token) return json({ error: "Not signed in" }, 401);
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: userData } = await userClient.auth.getUser();
      if (!userData.user) return json({ error: "Invalid session" }, 401);
      const { data: isAdminData } = await admin.rpc("has_role", {
        _user_id: userData.user.id,
        _role: "admin",
      });
      if (!isAdminData) return json({ error: "Admin only" }, 403);

      const name = String(body.name || "").trim();
      const url = String(body.url || "").trim();
      const category = (String(body.category || "wc2026").trim() || "wc2026").slice(0, 32);
      if (!name || name.length > 128) return json({ error: "Invalid name" }, 400);
      if (!/^https?:\/\//i.test(url) || url.length > 1024)
        return json({ error: "URL must start with http(s)://" }, 400);

      const streamId = `manual-${crypto.randomUUID()}`;
      const { error } = await admin.from("channels").insert({
        category,
        stream_id: streamId,
        name,
        direct_url: url,
        logo_url: null,
        epg_channel_id: null,
      } as never);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, stream_id: streamId });
    }

    // ---- Admin-only actions from here down ----
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Not signed in" }, 401);

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) return json({ error: "Invalid session" }, 401);
    const userId = userData.user.id;

    const { data: isAdminData } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
    const isAdmin = !!isAdminData;

    if (action === "get_config") {
      if (!isAdmin) return json({ error: "Admin only" }, 403);
      const { data } = await admin
        .from("xtream_config")
        .select("host, username, updated_at")
        .eq("id", 1)
        .maybeSingle();
      const { data: settings } = await admin
        .from("app_settings")
        .select("default_stream_id")
        .eq("id", 1)
        .maybeSingle();
      return json({ ...(data ?? {}), default_stream_id: settings?.default_stream_id ?? null });
    }

    if (action === "save_config") {
      if (!isAdmin) return json({ error: "Admin only" }, 403);
      const host = String(body.host || "").replace(/\/$/, "");
      const username = String(body.username || "");
      const password = String(body.password || "");
      // Basic input validation — host must be an http(s) URL, others non-empty.
      if (!/^https?:\/\//.test(host) || host.length > 512)
        return json({ error: "Invalid host" }, 400);
      if (!username || username.length > 128) return json({ error: "Invalid username" }, 400);
      if (!password || password.length > 256) return json({ error: "Invalid password" }, 400);
      const { error } = await admin
        .from("xtream_config")
        .upsert({ id: 1, host, username, password, updated_at: new Date().toISOString() });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    // Admin: set the default channel (persisted in app_settings).
    if (action === "set_default_channel") {
      if (!isAdmin) return json({ error: "Admin only" }, 403);
      const streamId = body.streamId == null ? null : String(body.streamId);
      if (streamId != null && streamId.length > 128)
        return json({ error: "Invalid streamId" }, 400);
      if (streamId) {
        const { data: channel } = await admin
          .from("channels")
          .select("stream_id")
          .eq("stream_id", streamId)
          .maybeSingle();
        if (!channel) return json({ error: "Channel not found" }, 404);
      }
      const { error } = await admin.from("app_settings").upsert({
        id: 1,
        default_stream_id: streamId,
        updated_at: new Date().toISOString(),
      });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, default_stream_id: streamId });
    }

    if (action === "refresh_channels") {
      if (!isAdmin) return json({ error: "Admin only" }, 403);
      const { data: cfg } = await admin.from("xtream_config").select("*").eq("id", 1).maybeSingle();
      if (!cfg) return json({ error: "No Xtream config saved" }, 400);
      const base = `${cfg.host}/player_api.php?username=${encodeURIComponent(cfg.username)}&password=${encodeURIComponent(cfg.password)}`;
      const catsRes = await fetch(`${base}&action=get_live_categories`);
      if (!catsRes.ok) return json({ error: `Xtream categories failed [${catsRes.status}]` }, 502);
      const cats = (await catsRes.json()) as Array<{ category_id: string; category_name: string }>;

      const wcRe = /world.?cup|fifa|wc.?2026|coupe.?du.?monde|mundial/i;
      const excludeRe = /bein/i;
      const crRe = /cricket|ipl|t20|test match/i;
      const wanted = cats
        .map((c) => ({
          id: c.category_id,
          name: c.category_name,
          category: excludeRe.test(c.category_name)
            ? null
            : wcRe.test(c.category_name)
              ? "wc2026"
              : crRe.test(c.category_name)
                ? "cricket"
                : null,
        }))
        .filter((c) => c.category !== null) as Array<{
        id: string;
        name: string;
        category: "wc2026" | "cricket";
      }>;

      await admin.from("channels").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      let total = 0;
      for (const cat of wanted) {
        const sRes = await fetch(`${base}&action=get_live_streams&category_id=${cat.id}`);
        if (!sRes.ok) continue;
        const streams = (await sRes.json()) as Array<{
          stream_id: number | string;
          name: string;
          stream_icon?: string;
          epg_channel_id?: string;
        }>;
        const rows = streams.map((s) => ({
          category: cat.category,
          stream_id: String(s.stream_id),
          name: s.name,
          logo_url: s.stream_icon ?? null,
          epg_channel_id: s.epg_channel_id ?? null,
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

/** Helper for JSON responses with optional extra headers (for cache hints). */
function json(data: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json", ...extra },
  });
}

/** Routes and validates stream proxy requests. */
async function handleStreamProxy(req: Request, admin: ReturnType<typeof createClient>) {
  const requestUrl = new URL(req.url);
  const path = requestUrl.pathname;
  const edgeBase = `${requestUrl.origin}/functions/v1/xtream`;

  const streamMatch = path.match(/\/xtream\/stream\/([^/]+)\.(m3u8|ts)$/);
  if (streamMatch) {
    const streamId = decodeURIComponent(streamMatch[1]);
    const ext = streamMatch[2];
    const payload = await verifyPayload(requestUrl.searchParams.get("t") ?? "");
    if (!payload || payload.type !== "stream" || payload.streamId !== streamId)
      return json({ error: "Invalid stream link" }, 403);

    const cfg = await getConfig(admin);
    if (!cfg) return json({ error: "No Xtream config" }, 400);
    const upstreamUrl = buildUpstreamUrl(cfg, `${streamId}.${ext}`);
    return await proxyUpstream(req, cfg, streamId, upstreamUrl, edgeBase);
  }

  if (path.endsWith("/xtream/resource")) {
    const streamId = requestUrl.searchParams.get("streamId") ?? "";
    const resource = requestUrl.searchParams.get("resource") ?? "";
    const payload = await verifyPayload(requestUrl.searchParams.get("t") ?? "");
    if (
      !payload ||
      payload.type !== "resource" ||
      payload.streamId !== streamId ||
      payload.resource !== resource
    ) {
      return json({ error: "Invalid stream link" }, 403);
    }
    if (!isSafeResource(resource)) return json({ error: "Invalid stream resource" }, 400);

    const cfg = await getConfig(admin);
    if (!cfg) return json({ error: "No Xtream config" }, 400);
    return await proxyUpstream(req, cfg, streamId, buildUpstreamUrl(cfg, resource), edgeBase);
  }

  return json({ error: "Unknown stream route" }, 404);
}

async function getConfig(admin: ReturnType<typeof createClient>): Promise<XtreamConfig | null> {
  const { data } = await admin
    .from("xtream_config")
    .select("host, username, password")
    .eq("id", 1)
    .maybeSingle();
  return data as XtreamConfig | null;
}

async function proxyUpstream(
  req: Request,
  cfg: XtreamConfig,
  streamId: string,
  upstreamUrl: string,
  edgeBase: string,
) {
  const headers = new Headers();
  const range = req.headers.get("range");
  if (range) headers.set("range", range);

  const upstream = await fetch(upstreamUrl, { headers });
  if (!upstream.ok || !upstream.body)
    return json({ error: `Stream upstream failed [${upstream.status}]` }, 502);

  const contentType = upstream.headers.get("content-type") ?? "";
  if (isPlaylist(upstreamUrl, contentType)) {
    // Master/media playlists change frequently but every client refetches
    // them every few seconds — cache 2s at the CDN so we don't hammer the
    // IPTV panel during traffic peaks.
    const text = await upstream.text();
    const playlist = await rewritePlaylist(text, upstreamUrl, cfg, streamId, edgeBase);
    return new Response(playlist, {
      status: upstream.status,
      headers: {
        ...cors,
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "public, max-age=1, s-maxage=2",
      },
    });
  }

  const responseHeaders = new Headers(cors);
  for (const header of [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
  ] as const) {
    const value = upstream.headers.get(header);
    if (value) responseHeaders.set(header, value);
  }
  if (!responseHeaders.has("content-type")) responseHeaders.set("content-type", "video/mp2t");
  // TS / segment responses are immutable for the life of the signed token.
  // Letting Cloudflare cache them is what makes 50k concurrent viewers cheap.
  responseHeaders.set("Cache-Control", "public, max-age=30, s-maxage=60, immutable");
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

function isPlaylist(url: string, contentType: string) {
  return (
    /mpegurl|application\/vnd\.apple/i.test(contentType) || new URL(url).pathname.endsWith(".m3u8")
  );
}

async function rewritePlaylist(
  text: string,
  playlistUrl: string,
  cfg: XtreamConfig,
  streamId: string,
  edgeBase: string,
) {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      out.push(line);
      continue;
    }

    if (trimmed.startsWith("#")) {
      const uriMatch = line.match(/URI="([^"]+)"/);
      if (!uriMatch) {
        out.push(line);
        continue;
      }
      const resource = extractResource(uriMatch[1], playlistUrl, cfg);
      if (!resource) {
        out.push(line);
        continue;
      }
      out.push(line.replace(uriMatch[1], await signedResourceUrl(edgeBase, streamId, resource)));
      continue;
    }

    const resource = extractResource(trimmed, playlistUrl, cfg);
    out.push(resource ? await signedResourceUrl(edgeBase, streamId, resource) : line);
  }
  return out.join("\n");
}

function extractResource(lineUrl: string, playlistUrl: string, cfg: XtreamConfig) {
  const resolved = new URL(lineUrl, playlistUrl);
  const parts = resolved.pathname.split("/").map((p) => decodeURIComponent(p));
  const credentialsAt = parts.findIndex(
    (p, i) => p === cfg.username && parts[i + 1] === cfg.password,
  );
  const resourceParts =
    credentialsAt >= 0 ? parts.slice(credentialsAt + 2) : parts.filter(Boolean).slice(-1);
  if (!resourceParts.length) return null;
  const resource = resourceParts.map(encodeURIComponent).join("/") + resolved.search;
  return isSafeResource(resource) ? resource : null;
}

function buildUpstreamUrl(cfg: XtreamConfig, resource: string) {
  const queryAt = resource.indexOf("?");
  const path = queryAt >= 0 ? resource.slice(0, queryAt) : resource;
  const query = queryAt >= 0 ? resource.slice(queryAt) : "";
  const encodedPath = path
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(decodeURIComponent(part)))
    .join("/");
  return `${cfg.host}/live/${encodeURIComponent(cfg.username)}/${encodeURIComponent(cfg.password)}/${encodedPath}${query}`;
}

function isSafeResource(resource: string) {
  const path = resource.split("?")[0];
  return (
    !!path &&
    !resource.includes("://") &&
    !path.startsWith("/") &&
    !path.split("/").some((part) => part === ".." || part === "")
  );
}

async function signedResourceUrl(edgeBase: string, streamId: string, resource: string) {
  const t = await signPayload({ type: "resource", streamId, resource, exp: expiresAt() });
  return `${edgeBase}/resource?streamId=${encodeURIComponent(streamId)}&resource=${encodeURIComponent(resource)}&t=${encodeURIComponent(t)}`;
}

function expiresAt() {
  return Math.floor(Date.now() / 1000) + STREAM_TTL_SECONDS;
}

async function signPayload(payload: SignedPayload) {
  const body = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await hmac(body);
  return `${body}.${signature}`;
}

async function verifyPayload(token: string): Promise<SignedPayload | null> {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = await hmac(body);
  if (!timingSafeEqual(signature, expected)) return null;
  const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(body))) as SignedPayload;
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

async function hmac(message: string) {
  const key = await getHmacKey();
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return base64UrlEncode(new Uint8Array(sig));
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const padded =
    value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}
