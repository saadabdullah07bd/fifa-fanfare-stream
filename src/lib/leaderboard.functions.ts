import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export const getLeaderboard = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data: preds } = await sb.from("predictions").select("user_id, points");
  const { data: profiles } = await sb.from("profiles").select("id, display_name, avatar_url");
  const totals = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const p of preds ?? []) {
    totals.set(p.user_id, (totals.get(p.user_id) ?? 0) + (p.points ?? 0));
    counts.set(p.user_id, (counts.get(p.user_id) ?? 0) + 1);
  }
  const rows = Array.from(totals.entries()).map(([user_id, pts]) => {
    const p = (profiles ?? []).find((x) => x.id === user_id);
    return {
      user_id,
      points: pts,
      predictions: counts.get(user_id) ?? 0,
      display_name: p?.display_name ?? "Fan",
      avatar_url: p?.avatar_url ?? null,
    };
  });
  rows.sort((a, b) => b.points - a.points || b.predictions - a.predictions);
  return rows.slice(0, 50);
});
