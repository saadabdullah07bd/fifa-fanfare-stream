import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getAppConfig } from "@/lib/appConfig";

/**
 * Google One Tap sign-in for web browsers.
 *
 * Renders the invisible One Tap prompt on any public route while the user is
 * signed-out. Uses `signInWithIdToken` so Supabase can verify the Google ID
 * token directly — no redirect round-trip.
 *
 * One Tap does NOT render inside an editor/preview iframe (Google refuses to
 * embed cross-origin), only in the published site or the preview URL opened
 * in its own tab.
 */

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (o: {
            client_id: string;
            callback: (r: { credential: string }) => void;
            nonce?: string;
            use_fedcm_for_prompt?: boolean;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
            itp_support?: boolean;
          }) => void;
          prompt: () => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

async function sha256Base64Url(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function isInIframe() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export default function GoogleOneTap() {
  const { pathname } = useLocation();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const shown = useRef(false);

  // Track auth state so One Tap disappears once the user signs in.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (authed !== false) return; // wait for signed-out
    if (pathname === "/auth") return; // dedicated page owns UI
    if (isInIframe()) return; // won't render inside editor
    if (shown.current) return;

    let cancelled = false;
    (async () => {
      const cfg = await getAppConfig();
      if (!cfg.googleClientId) return;

      // Load Google Identity Services script on demand.
      await new Promise<void>((resolve) => {
        if (window.google?.accounts?.id) return resolve();
        const s = document.createElement("script");
        s.src = "https://accounts.google.com/gsi/client";
        s.async = true;
        s.defer = true;
        s.onload = () => resolve();
        s.onerror = () => resolve();
        document.head.appendChild(s);
      });

      if (cancelled || !window.google?.accounts?.id) return;

      // Nonce: raw stays on client, SHA-256'd nonce goes to Google.
      const rawNonce = crypto.randomUUID() + crypto.randomUUID();
      const hashedNonce = await sha256Base64Url(rawNonce);

      window.google.accounts.id.initialize({
        client_id: cfg.googleClientId,
        nonce: hashedNonce,
        auto_select: false,
        cancel_on_tap_outside: true,
        itp_support: true,
        use_fedcm_for_prompt: true,
        callback: async ({ credential }) => {
          const { error } = await supabase.auth.signInWithIdToken({
            provider: "google",
            token: credential,
            nonce: rawNonce,
          });
          if (error) console.error("One Tap sign-in failed:", error.message);
        },
      });

      window.google.accounts.id.prompt();
      shown.current = true;
    })();

    return () => {
      cancelled = true;
    };
  }, [authed, pathname]);

  return null;
}
