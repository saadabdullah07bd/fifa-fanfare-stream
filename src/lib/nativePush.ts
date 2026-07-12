import { supabase } from "@/integrations/supabase/client";

/**
 * Register the device's native FCM token via Capacitor Push Notifications.
 * Only runs inside a Capacitor shell (Android/iOS). On the web it's a no-op.
 */
export async function registerNativePush(userId: string): Promise<void> {
  try {
    const [{ PushNotifications }, capCore] = await Promise.all([
      import("@capacitor/push-notifications"),
      import("@capacitor/core"),
    ]);
    if (!capCore.Capacitor.isNativePlatform()) return;

    const permStatus = await PushNotifications.checkPermissions();
    let receive = permStatus.receive;
    if (receive === "prompt" || receive === "prompt-with-rationale") {
      receive = (await PushNotifications.requestPermissions()).receive;
    }
    if (receive !== "granted") return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const platform = (capCore.Capacitor.getPlatform() as any) === "ios" ? "ios" : "android";

    await PushNotifications.addListener("registration", async (t) => {
      await supabase.from("push_tokens").upsert(
        { user_id: userId, token: t.value, platform, last_seen_at: new Date().toISOString() },
        { onConflict: "token" },
      );
    });
    await PushNotifications.addListener("registrationError", (e) => {
      console.warn("Push registrationError:", e);
    });

    await PushNotifications.register();
  } catch (err) {
    console.warn("registerNativePush failed:", err);
  }
}
