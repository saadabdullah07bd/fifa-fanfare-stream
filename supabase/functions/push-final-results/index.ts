/* Final-result pushes: fires once per match when status flips to FINISHED.
 * Dedupe key = "final:<match_id>". Runs every ~5 min via pg_cron. */
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { fcmSendToTokens } from '../_shared/fcm.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (cronSecret && req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    // Look at matches finished in the last 2 hours.
    const cutoff = new Date(Date.now() - 2 * 3600_000).toISOString();
    const { data: finished } = await supabase
      .from('matches')
      .select('id, home_team_code, away_team_code, home_score, away_score, status, date_utc')
      .in('status', ['FINISHED', 'FT', 'AWARDED'])
      .gte('date_utc', cutoff);

    let sent = 0;
    for (const m of finished ?? []) {
      const dedupeKey = `final:${m.id}`;
      const home = m.home_score ?? 0;
      const away = m.away_score ?? 0;
      const winner =
        home > away ? `${m.home_team_code} win` :
        home < away ? `${m.away_team_code} win` : 'Draw';
      const title = '🏁 Full-time';
      const body = `${m.home_team_code} ${home} – ${away} ${m.away_team_code}  ·  ${winner}`;

      const { data: favs } = await supabase
        .from('favorites').select('user_id').in('team_code', [m.home_team_code, m.away_team_code]);
      const userIds = [...new Set((favs ?? []).map((f) => f.user_id))];
      if (!userIds.length) continue;

      const { data: profiles } = await supabase
        .from('profiles').select('id').in('id', userIds).eq('notif_match_events', true);
      const eligible = (profiles ?? []).map((p) => p.id);
      if (!eligible.length) continue;

      const { data: sentAlready } = await supabase
        .from('notification_log').select('user_id').eq('dedupe_key', dedupeKey).in('user_id', eligible);
      const skip = new Set((sentAlready ?? []).map((r) => r.user_id));
      const targets = eligible.filter((u) => !skip.has(u));
      if (!targets.length) continue;

      const { data: tokens } = await supabase
        .from('push_tokens').select('user_id, token').in('user_id', targets);
      if (!tokens?.length) continue;

      const results = await fcmSendToTokens(
        tokens.map((t) => t.token),
        { title, body },
        { type: 'final', match_id: m.id, url: `/match/${m.id}` },
      );
      const tokenToUser = new Map(tokens.map((t) => [t.token, t.user_id]));
      const successUsers = new Set<string>();
      const deadTokens: string[] = [];
      for (const r of results) {
        if (r.ok) { const uid = tokenToUser.get(r.token); if (uid) successUsers.add(uid); }
        if (r.deadToken) deadTokens.push(r.token);
      }
      if (deadTokens.length) await supabase.from('push_tokens').delete().in('token', deadTokens);
      if (successUsers.size) {
        await supabase.from('notification_log').insert(
          [...successUsers].map((uid) => ({
            user_id: uid, type: 'final', match_id: m.id, dedupe_key: dedupeKey, title, body,
          })),
        );
        sent += successUsers.size;
      }
    }

    return new Response(JSON.stringify({ ok: true, sent }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('push-final-results failed:', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
