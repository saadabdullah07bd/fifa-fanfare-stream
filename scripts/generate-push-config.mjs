// Writes public/push-config.json for the Firebase messaging service worker.
// The SW cannot read Vite env vars, so we bake the Supabase client-config URL here.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const config = {
  clientConfigUrl: url ? `${url.replace(/\/$/, "")}/functions/v1/client-config` : null,
  supabaseAnonKey: key ?? null,
};

writeFileSync(resolve("public/push-config.json"), JSON.stringify(config, null, 2));
console.log("push-config.json written");
