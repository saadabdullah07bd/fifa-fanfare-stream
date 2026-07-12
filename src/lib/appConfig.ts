import { supabase } from "@/integrations/supabase/client";

/**
 * Publishable client-side config fetched from the `client-config` edge function.
 * These values are safe to ship to the browser (they're the same values Firebase
 * and Google embed in any web app that talks to them), but we fetch them at
 * runtime so nothing has to be baked into the build.
 */
export type AppClientConfig = {
  firebase: {
    apiKey?: string;
    authDomain?: string;
    projectId?: string;
    storageBucket?: string;
    messagingSenderId?: string;
    appId?: string;
  };
  firebaseVapidKey: string;
  googleClientId: string;
};

let cache: Promise<AppClientConfig> | null = null;

export function getAppConfig(): Promise<AppClientConfig> {
  if (cache) return cache;
  cache = (async () => {
    const { data, error } = await supabase.functions.invoke("client-config");
    if (error || !data) {
      console.warn("client-config failed:", error);
      return { firebase: {}, firebaseVapidKey: "", googleClientId: "" };
    }
    return data as AppClientConfig;
  })();
  return cache;
}
