import { getToken, onMessage } from "firebase/messaging";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getAppConfig } from "@/lib/appConfig";
import { getFirebaseMessaging } from "@/lib/firebase";

/**
 * Register (or refresh) the current browser's Firebase Cloud Messaging token
 * for the signed-in user, and start listening for foreground pushes.
 *
 * Safe to call multiple times: the DB uses a unique constraint on the token so
 * upserting the same token per session is a no-op.
 */
export async function registerWebPush(userId: string): Promise<void> {
  try {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;

    // Ask permission if we haven't already. We do this quietly — Auth page and
    // the settings toggle can request it interactively later if it was denied.
    if (Notification.permission === "default") {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return;
    } else if (Notification.permission !== "granted") {
      return;
    }

    const cfg = await getAppConfig();
    if (!cfg.firebaseVapidKey) return;

    const messaging = await getFirebaseMessaging();
    if (!messaging) return;

    const swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      scope: "/firebase-cloud-messaging-push-scope",
    });

    const token = await getToken(messaging, {
      vapidKey: cfg.firebaseVapidKey,
      serviceWorkerRegistration: swReg,
    });
    if (!token) return;

    await supabase.from("push_tokens").upsert(
      { user_id: userId, token, platform: "web", last_seen_at: new Date().toISOString() },
      { onConflict: "token" },
    );

    onMessage(messaging, (payload) => {
      const title = payload.notification?.title ?? payload.data?.title ?? "Pitch26";
      const body = payload.notification?.body ?? payload.data?.body ?? "";
      toast(title, { description: body });
    });
  } catch (err) {
    console.warn("registerWebPush failed:", err);
  }
}
