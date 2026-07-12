import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { registerWebPush } from "@/lib/push";
import { registerNativePush } from "@/lib/nativePush";

/**
 * Global side-effect component: whenever a user is signed in, register the
 * current device's push token (web FCM for browsers, native FCM for
 * Capacitor). Silent — errors are logged but never surface as UI.
 */
export default function PushBootstrap() {
  useEffect(() => {
    let cancelled = false;

    async function bootFor(userId: string) {
      if (cancelled) return;
      // Prefer native registration when running inside the Capacitor shell.
      const isNative = typeof (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
        .Capacitor?.isNativePlatform === "function"
        && (window as unknown as { Capacitor: { isNativePlatform: () => boolean } })
          .Capacitor.isNativePlatform();
      if (isNative) {
        await registerNativePush(userId);
      } else {
        await registerWebPush(userId);
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user?.id) bootFor(data.session.user.id);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user?.id) bootFor(session.user.id);
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  return null;
}
