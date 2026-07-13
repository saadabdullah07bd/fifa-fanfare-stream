/* News alerts: pushes each new news headline to users with notif_news = true.
 * Dedupe key = "news:<news_id>". Runs every ~10 min via pg_cron. */
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
    const since = new Date(Date.now() - 30 * 60_000).toISOString();
    const { data: news } = await supabase
      .from("news")
      .select("id, title, summary, url, published_at")
      .gte("published_at", since)
      .order("published_at", { ascending: false })
      .limit(10);

    if (!news?.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profiles } = await supabase.from("profiles").select("id").eq("notif_news", true);
    const eligible = (profiles ?? []).map((p) => p.id);
    if (!eligible.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    for (const item of news) {
      const dedupeKey = `news:${item.id}`;
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

      const title = "📰 " + (item.title.length > 60 ? item.title.slice(0, 57) + "…" : item.title);
      const body = item.summary?.slice(0, 140) ?? "";

      const results = await fcmSendToTokens(
        tokens.map((t) => t.token),
        { title, body },
        { type: "news", news_id: item.id, url: "/news" },
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
            type: "news",
            news_id: item.id,
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
    console.error("push-news-headlines failed:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
