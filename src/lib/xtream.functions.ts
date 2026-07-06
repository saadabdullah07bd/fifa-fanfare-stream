import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const XtreamConfigSchema = z.object({
  host: z.string().url().refine((u) => /^https?:\/\//.test(u), "host must start with http(s)://"),
  username: z.string().min(1),
  password: z.string().min(1),
});

async function assertAdmin(context: { supabase: ReturnType<typeof createClient<Database>>; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

function admin() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export const isAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { admin: !!data };
  });

// Admin: save shared Xtream config (single row)
export const saveXtreamConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => XtreamConfigSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const host = data.host.replace(/\/$/, "");
    const { error } = await context.supabase.from("xtream_config").upsert({
      id: 1,
      host,
      username: data.username,
      password: data.password,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Anyone signed in can see host/username (not password) — used by settings page
export const getXtreamConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const sb = admin();
    const { data } = await sb
      .from("xtream_config")
      .select("host, username, updated_at")
      .eq("id", 1)
      .maybeSingle();
    return data;
  });

// Admin: refresh channel cache from Xtream server
export const refreshChannels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const sb = admin();
    const { data: cfg } = await sb.from("xtream_config").select("*").eq("id", 1).maybeSingle();
    if (!cfg) throw new Error("No Xtream config saved");

    const base = `${cfg.host}/player_api.php?username=${encodeURIComponent(cfg.username)}&password=${encodeURIComponent(cfg.password)}`;
    const catsRes = await fetch(`${base}&action=get_live_categories`);
    if (!catsRes.ok) throw new Error(`Xtream categories failed [${catsRes.status}]`);
    const cats = (await catsRes.json()) as Array<{ category_id: string; category_name: string }>;

    const wcRe = /world.?cup|fifa|wc.?2026/i;
    const crRe = /cricket|ipl|t20|test match/i;
    const wanted = cats
      .map((c) => ({
        id: c.category_id,
        name: c.category_name,
        category: wcRe.test(c.category_name)
          ? ("wc2026" as const)
          : crRe.test(c.category_name)
            ? ("cricket" as const)
            : null,
      }))
      .filter((c) => c.category !== null);

    await sb.from("channels").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    let total = 0;
    for (const cat of wanted) {
      const streamsRes = await fetch(`${base}&action=get_live_streams&category_id=${cat.id}`);
      if (!streamsRes.ok) continue;
      const streams = (await streamsRes.json()) as Array<{
        stream_id: number | string;
        name: string;
        stream_icon?: string;
        epg_channel_id?: string;
      }>;
      const rows = streams.map((s) => ({
        category: cat.category!,
        stream_id: String(s.stream_id),
        name: s.name,
        logo_url: s.stream_icon ?? null,
        epg_channel_id: s.epg_channel_id ?? null,
      }));
      if (rows.length) {
        await sb.from("channels").upsert(rows, { onConflict: "category,stream_id" });
        total += rows.length;
      }
    }
    return { ok: true, categories: wanted.length, channels: total };
  });

// Any signed-in user: list channels
export const getChannels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("channels")
      .select("*")
      .order("category")
      .order("name");
    return data ?? [];
  });

// Any signed-in user: get playable HLS URL for a stream
export const getStreamUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ streamId: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const sb = admin();
    const { data: cfg } = await sb.from("xtream_config").select("*").eq("id", 1).maybeSingle();
    if (!cfg) throw new Error("No Xtream config");
    const url = `${cfg.host}/live/${encodeURIComponent(cfg.username)}/${encodeURIComponent(cfg.password)}/${data.streamId}.m3u8`;
    return { url };
  });
