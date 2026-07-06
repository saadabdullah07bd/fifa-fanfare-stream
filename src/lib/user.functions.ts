import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listFavorites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("favorites")
      .select("team_code")
      .eq("user_id", context.userId);
    return (data ?? []).map((f) => f.team_code);
  });

export const toggleFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ teamCode: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("favorites")
      .select("id")
      .eq("user_id", context.userId)
      .eq("team_code", data.teamCode)
      .maybeSingle();
    if (existing) {
      await context.supabase.from("favorites").delete().eq("id", existing.id);
      return { favorited: false };
    }
    await context.supabase.from("favorites").insert({ user_id: context.userId, team_code: data.teamCode });
    return { favorited: true };
  });

export const upsertPrediction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      matchId: z.string().uuid(),
      homeScore: z.number().int().min(0).max(20),
      awayScore: z.number().int().min(0).max(20),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("predictions").upsert(
      {
        user_id: context.userId,
        match_id: data.matchId,
        home_score: data.homeScore,
        away_score: data.awayScore,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,match_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyPredictions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("predictions")
      .select("*")
      .eq("user_id", context.userId);
    return data ?? [];
  });
