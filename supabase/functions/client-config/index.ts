import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

/**
 * Returns publishable client-side config (Firebase Web + Google OAuth Web Client ID)
 * so the SPA can read them at runtime without embedding at build time.
 */

function parseFirebaseWebConfig(raw: string): Record<string, string> {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return {};
  // Try strict JSON first.
  try { return JSON.parse(trimmed); } catch { /* fall through */ }
  // Try JS object literal (unquoted keys / single quotes) by extracting fields via regex.
  const out: Record<string, string> = {};
  const fields = [
    'apiKey', 'authDomain', 'databaseURL', 'projectId',
    'storageBucket', 'messagingSenderId', 'appId', 'measurementId',
  ];
  for (const key of fields) {
    const m = trimmed.match(new RegExp(`["']?${key}["']?\\s*[:=]\\s*["']([^"']+)["']`));
    if (m) out[key] = m[1];
  }
  return out;
}

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const firebase = parseFirebaseWebConfig(Deno.env.get('FIREBASE_WEB_CONFIG') ?? '');
  const body = {
    firebase,
    firebaseVapidKey: Deno.env.get('FIREBASE_VAPID_KEY') ?? '',
    googleClientId: Deno.env.get('GOOGLE_OAUTH_WEB_CLIENT_ID') ?? '',
  };

  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
    },
  });
});
