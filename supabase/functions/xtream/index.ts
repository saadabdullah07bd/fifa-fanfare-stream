// Xtream Codes proxy: save config, get config (sanitized), refresh channels, get stream URL.
// Admin-only for writes and refresh. Any signed-in user can request a stream URL.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Not signed in" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) return json({ error: "Invalid session" }, 401);
    const userId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: isAdminData } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
    const isAdmin = !!isAdminData;

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    if (action === "get_config") {
      if (!isAdmin) return json({ error: "Admin only" }, 403);
      const { data } = await admin.from("xtream_config").select("host, username, updated_at").eq("id", 1).maybeSingle();
      return json(data);
    }

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

    if (action === "refresh_channels") {
      if (!isAdmin) return json({ error: "Admin only" }, 403);
      const { data: cfg } = await admin.from("xtream_config").select("*").eq("id", 1).maybeSingle();
      if (!cfg) return json({ error: "No Xtream config saved" }, 400);
      const base = `${cfg.host}/player_api.php?username=${encodeURIComponent(cfg.username)}&password=${encodeURIComponent(cfg.password)}`;
      const catsRes = await fetch(`${base}&action=get_live_categories`);
      if (!catsRes.ok) return json({ error: `Xtream categories failed [${catsRes.status}]` }, 502);
      const cats = await catsRes.json() as Array<{ category_id: string; category_name: string }>;
      const wcRe = /world.?cup|fifa|wc.?2026/i;
      const crRe = /cricket|ipl|t20|test match/i;
      const wanted = cats
        .map((c) => ({ id: c.category_id, name: c.category_name,
          category: wcRe.test(c.category_name) ? "wc2026" : crRe.test(c.category_name) ? "cricket" : null }))
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

    if (action === "stream_url") {
      const streamId = String(body.streamId || "");
      if (!streamId) return json({ error: "streamId required" }, 400);
      const { data: cfg } = await admin.from("xtream_config").select("*").eq("id", 1).maybeSingle();
      if (!cfg) return json({ error: "No Xtream config" }, 400);
      const url = `${cfg.host}/live/${encodeURIComponent(cfg.username)}/${encodeURIComponent(cfg.password)}/${streamId}.m3u8`;
      return json({ url });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
