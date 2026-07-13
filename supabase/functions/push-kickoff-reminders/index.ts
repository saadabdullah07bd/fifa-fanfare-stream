/* Kickoff reminders: fires for matches starting in the next 5–10 minutes.
 * Runs every ~5 minutes via pg_cron. Dedupe key = "kickoff:<match_id>". */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fcmSendToTokens } from "../_shared/fcm.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Simple cron-secret guard: pg_cron passes a Bearer token in the body/header.
  const cronSecret = Deno.env.get("CRON_SECRET");
  const auth = req.headers.get("x-cron-secret") || "";
  if (cronSecret && auth !== cronSecret) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const now = new Date();
    const start = new Date(now.getTime() + 5 * 60_000);
    const end = new Date(now.getTime() + 11 * 60_000);

    const { data: matches } = await supabase
      .from("matches")
      .select("id, date_utc, home_team_code, away_team_code, status")
      .gte("date_utc", start.toISOString())
      .lt("date_utc", end.toISOString())
      .neq("status", "FINISHED");

    let sent = 0;
    for (const m of matches ?? []) {
      const dedupeKey = `kickoff:${m.id}`;

      // Fans of either side (favorites.team_code)
      const { data: favs } = await supabase
        .from("favorites")
        .select("user_id")
        .in("team_code", [m.home_team_code, m.away_team_code]);
      if (!favs?.length) continue;

      const userIds = [...new Set(favs.map((f) => f.user_id))];

      // Skip users who opted out or already got this notification.
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id")
        .in("id", userIds)
        .eq("notif_match_events", true);
      const eligible = (profiles ?? []).map((p) => p.id);
      if (!eligible.length) continue;

      const { data: alreadySent } = await supabase
        .from("notification_log")
        .select("user_id")
        .eq("dedupe_key", dedupeKey)
        .in("user_id", eligible);
      const skip = new Set((alreadySent ?? []).map((r) => r.user_id));
      const targets = eligible.filter((u) => !skip.has(u));
      if (!targets.length) continue;

      const { data: tokens } = await supabase
        .from("push_tokens")
        .select("user_id, token")
        .in("user_id", targets);
      if (!tokens?.length) continue;

      const mins = Math.round((new Date(m.date_utc).getTime() - now.getTime()) / 60_000);
      const title = "⚽ Match starting soon";
      const body = `${m.home_team_code} vs ${m.away_team_code} kicks off in ${mins} min`;

      const results = await fcmSendToTokens(
        tokens.map((t) => t.token),
        { title, body },
        { type: "kickoff", match_id: m.id, url: `/match/${m.id}` },
      );

      const tokenToUser = new Map(tokens.map((t) => [t.token, t.user_id]));
      const successUsers = new Set<string>();
      const deadTokens: string[] = [];
      for (const r of results) {
        if (r.ok) {
          const uid = tokenToUser.get(r.token);
          if (uid) successUsers.add(uid);
        }
        if (r.deadToken) deadTokens.push(r.token);
      }
      if (deadTokens.length) {
        await supabase.from("push_tokens").delete().in("token", deadTokens);
      }
      if (successUsers.size) {
        await supabase.from("notification_log").insert(
          [...successUsers].map((uid) => ({
            user_id: uid,
            type: "kickoff",
            match_id: m.id,
            dedupe_key: dedupeKey,
            title,
            body,
          })),
        );
        sent += successUsers.size;
      }
    }

    return new Response(JSON.stringify({ ok: true, sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("push-kickoff-reminders failed:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
