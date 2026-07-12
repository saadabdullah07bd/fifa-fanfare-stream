import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getMessaging, isSupported, type Messaging } from "firebase/messaging";
import { getAppConfig } from "@/lib/appConfig";

let appPromise: Promise<FirebaseApp | null> | null = null;
let messagingPromise: Promise<Messaging | null> | null = null;

/**
 * Lazily initialize the Firebase JS SDK using the publishable config returned
 * by the `client-config` edge function.
 */
export function getFirebaseApp(): Promise<FirebaseApp | null> {
  if (appPromise) return appPromise;
  appPromise = (async () => {
    const cfg = await getAppConfig();
    if (!cfg.firebase?.projectId || !cfg.firebase?.apiKey) return null;
    if (getApps().length) return getApps()[0];
    return initializeApp(cfg.firebase);
  })();
  return appPromise;
}

/**
 * Returns a Firebase Messaging instance if the current browser supports web
 * push (secure context + service workers + Push API), otherwise `null`.
 */
export function getFirebaseMessaging(): Promise<Messaging | null> {
  if (messagingPromise) return messagingPromise;
  messagingPromise = (async () => {
    if (typeof window === "undefined") return null;
    if (!(await isSupported())) return null;
    const app = await getFirebaseApp();
    if (!app) return null;
    return getMessaging(app);
  })();
  return messagingPromise;
}
