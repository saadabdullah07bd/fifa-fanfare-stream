import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

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
      const isNative =
        typeof (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
          ?.isNativePlatform === "function" &&
        (
          window as unknown as { Capacitor: { isNativePlatform: () => boolean } }
        ).Capacitor.isNativePlatform();
      if (isNative) {
        const { registerNativePush } = await import("@/lib/nativePush");
        await registerNativePush(userId);
      } else {
        // firebase/messaging is a heavy SDK — split out of the eager main
        // bundle and only fetched once a session actually exists to register.
        const { registerWebPush } = await import("@/lib/push");
        await registerWebPush(userId);
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user?.id) bootFor(data.session.user.id);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user?.id) bootFor(session.user.id);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return null;
}
