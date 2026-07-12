import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

/**
 * Returns publishable client-side config (Firebase Web + Google OAuth Web Client ID)
 * so the SPA can read them at runtime without embedding at build time.
 */

function parseFirebaseWebConfig(raw: string): Record<string, string> {
  const trimmed = (raw ?? '').trim();
  const out: Record<string, string> = {};
  const fields = [
    'apiKey', 'authDomain', 'databaseURL', 'projectId',
    'storageBucket', 'messagingSenderId', 'appId', 'measurementId',
  ];
  if (trimmed) {
    // Try strict JSON first.
    try {
      const parsed = JSON.parse(trimmed);
      for (const k of fields) if (typeof parsed[k] === 'string') out[k] = parsed[k];
      if (Object.keys(out).length) return out;
    } catch { /* ignore */ }
    // Loose match: `apiKey: "xxx"`, `apiKey = xxx`, `"apiKey":"xxx"`, one per line.
    for (const key of fields) {
      const m = trimmed.match(new RegExp(`["']?${key}["']?\\s*[:=]\\s*["']?([A-Za-z0-9_\\-.:/@]+)["']?`));
      if (m) out[key] = m[1];
    }
  }
  // Env-var fallbacks: FIREBASE_API_KEY, FIREBASE_PROJECT_ID, etc.
  const envMap: Record<string, string> = {
    apiKey: 'FIREBASE_API_KEY',
    authDomain: 'FIREBASE_AUTH_DOMAIN',
    projectId: 'FIREBASE_PROJECT_ID',
    storageBucket: 'FIREBASE_STORAGE_BUCKET',
    messagingSenderId: 'FIREBASE_MESSAGING_SENDER_ID',
    appId: 'FIREBASE_APP_ID',
    measurementId: 'FIREBASE_MEASUREMENT_ID',
  };
  for (const [k, envName] of Object.entries(envMap)) {
    if (!out[k]) {
      const v = Deno.env.get(envName);
      if (v) out[k] = v;
    }
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
