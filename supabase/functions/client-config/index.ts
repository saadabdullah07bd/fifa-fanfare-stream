import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

/**
 * Returns the Google OAuth Web Client ID for the SPA's One Tap flow.
 *
 * Web push (Firebase Cloud Messaging in the browser) is intentionally NOT
 * wired up for this project — the app targets Android APK only, where push
 * is delivered via the native FCM SDK reading `google-services.json`.
 * We therefore return empty values for the web Firebase config; the web push
 * bootstrap in the client is defensive against that and silently skips.
 */
Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const body = {
    firebase: {},
    firebaseVapidKey: '',
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
