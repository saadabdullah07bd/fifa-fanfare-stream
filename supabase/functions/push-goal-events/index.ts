/* Goal alerts: watches live matches, sends "GOAL!" pushes whenever the score
 * differs from the last snapshot in `match_score_snapshots`. Runs every minute.
 * Dedupe key = "goal:<match_id>:<home>-<away>". */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fcmSendToTokens } from "../_shared/fcm.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret && req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Live-ish matches only: status IN_PLAY / LIVE / HT / PAUSED etc.
    const { data: live } = await supabase
      .from("matches")
      .select("id, home_team_code, away_team_code, home_score, away_score, status, minute")
      .in("status", ["IN_PLAY", "LIVE", "HT", "PAUSED", "HALFTIME"]);

    let sent = 0;
    for (const m of live ?? []) {
      const home = m.home_score ?? 0;
      const away = m.away_score ?? 0;

      const { data: snap } = await supabase
        .from("match_score_snapshots")
        .select("*")
        .eq("match_id", m.id)
        .maybeSingle();

      const prevHome = snap?.home_score ?? 0;
      const prevAway = snap?.away_score ?? 0;

      // Always upsert snapshot to keep it current.
      await supabase.from("match_score_snapshots").upsert(
        {
          match_id: m.id,
          home_score: home,
          away_score: away,
          status: m.status,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "match_id" },
      );

      if (home === prevHome && away === prevAway) continue;
      // First time we're seeing this match & score is 0-0 → nothing to announce.
      if (!snap && home === 0 && away === 0) continue;

      const scoringSide = home > prevHome ? m.home_team_code : m.away_team_code;
      const dedupeKey = `goal:${m.id}:${home}-${away}`;
      const title = `⚽ GOAL! ${scoringSide}`;
      const body = `${m.home_team_code} ${home} – ${away} ${m.away_team_code}${m.minute ? `  ·  ${m.minute}'` : ""}`;

      const { data: favs } = await supabase
        .from("favorites")
        .select("user_id")
        .in("team_code", [m.home_team_code, m.away_team_code]);
      const userIds = [...new Set((favs ?? []).map((f) => f.user_id))];
      if (!userIds.length) continue;

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id")
        .in("id", userIds)
        .eq("notif_match_events", true);
      const eligible = (profiles ?? []).map((p) => p.id);
      if (!eligible.length) continue;

      const { data: sentAlready } = await supabase
        .from("notification_log")
        .select("user_id")
        .eq("dedupe_key", dedupeKey)
        .in("user_id", eligible);
      const skip = new Set((sentAlready ?? []).map((r) => r.user_id));
      const targets = eligible.filter((u) => !skip.has(u));
      if (!targets.length) continue;

      const { data: tokens } = await supabase
        .from("push_tokens")
        .select("user_id, token")
        .in("user_id", targets);
      if (!tokens?.length) continue;

      const results = await fcmSendToTokens(
        tokens.map((t) => t.token),
        { title, body },
        { type: "goal", match_id: m.id, url: `/match/${m.id}` },
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
      if (deadTokens.length) await supabase.from("push_tokens").delete().in("token", deadTokens);
      if (successUsers.size) {
        await supabase.from("notification_log").insert(
          [...successUsers].map((uid) => ({
            user_id: uid,
            type: "goal",
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
    console.error("push-goal-events failed:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
