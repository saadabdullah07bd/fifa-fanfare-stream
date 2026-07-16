/* Firebase Cloud Messaging background service worker.
 *
 * Fetches publishable config from the app's `client-config` edge function at
 * install/activate time so nothing has to be hard-coded here. Displays a
 * notification for every incoming background push.
 */
importScripts("https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js");

async function resolveClientConfigUrl() {
  try {
    const res = await fetch("/push-config.json", { cache: "no-store" });
    if (res.ok) {
      const cfg = await res.json();
      if (cfg?.clientConfigUrl) return cfg.clientConfigUrl;
    }
  } catch {
    /* fall through */
  }
  return new URL("/functions/v1/client-config", self.location.origin).href;
}

async function boot() {
  try {
    const configUrl = await resolveClientConfigUrl();
    let pushCfg = {};
    try {
      const pc = await fetch("/push-config.json", { cache: "no-store" });
      if (pc.ok) pushCfg = await pc.json();
    } catch {
      /* noop */
    }
    const headers = { "Content-Type": "application/json" };
    if (pushCfg.supabaseAnonKey) headers.apikey = pushCfg.supabaseAnonKey;
    const res = await fetch(configUrl, {
      method: "POST",
      headers,
      body: "{}",
    });
    const cfg = await res.json();
    if (!cfg?.firebase?.projectId) return;
    firebase.initializeApp(cfg.firebase);
    const messaging = firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
      const title = payload.notification?.title || payload.data?.title || "Pitch26";
      const options = {
        body: payload.notification?.body || payload.data?.body || "",
        icon: "/app-icon.png",
        badge: "/app-icon.png",
        data: payload.data || {},
      };
      self.registration.showNotification(title, options);
    });
  } catch (e) {
    // Best-effort; failures here just mean no background pushes on this device.
    console.warn("firebase-messaging-sw boot failed", e);
  }
}

self.addEventListener("install", (e) => {
  e.waitUntil(self.skipWaiting());
});
self.addEventListener("activate", (e) => {
  e.waitUntil(Promise.all([self.clients.claim(), boot()]));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});

// Also boot on push in case the SW was terminated between activate and delivery.
self.addEventListener("push", (event) => {
  event.waitUntil(boot());
});
