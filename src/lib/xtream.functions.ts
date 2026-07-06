import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const XtreamConfigSchema = z.object({
  host: z.string().url().refine((u) => /^https?:\/\//.test(u), "host must start with http(s)://"),
  username: z.string().min(1),
  password: z.string().min(1),
});

// Save the user's Xtream Codes server credentials.
export const saveXtreamConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => XtreamConfigSchema.parse(d))
  .handler(async ({ data, context }) => {
    const host = data.host.replace(/\/$/, "");
    const { error } = await context.supabase.from("xtream_config").upsert({
      user_id: context.userId,
      host,
      username: data.username,
      password: data.password,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getXtreamConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("xtream_config")
      .select("host, username, updated_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    return data;
  });

// Refresh: fetch categories + streams from Xtream, keep only WC 2026 & Cricket
export const refreshChannels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: cfg } = await context.supabase
      .from("xtream_config")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
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

    // Clear existing cached channels for this user
    await context.supabase.from("channels").delete().eq("user_id", context.userId);

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
        user_id: context.userId,
        category: cat.category!,
        stream_id: String(s.stream_id),
        name: s.name,
        logo_url: s.stream_icon ?? null,
        epg_channel_id: s.epg_channel_id ?? null,
      }));
      if (rows.length) {
        await context.supabase.from("channels").insert(rows);
        total += rows.length;
      }
    }
    return { ok: true, categories: wanted.length, channels: total };
  });

export const getChannels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("channels")
      .select("*")
      .eq("user_id", context.userId)
      .order("category")
      .order("name");
    return data ?? [];
  });

export const getStreamUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ streamId: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: cfg } = await context.supabase
      .from("xtream_config")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!cfg) throw new Error("No Xtream config");
    // HLS m3u8 endpoint standard to Xtream Codes
    const url = `${cfg.host}/live/${encodeURIComponent(cfg.username)}/${encodeURIComponent(cfg.password)}/${data.streamId}.m3u8`;
    return { url };
  });
