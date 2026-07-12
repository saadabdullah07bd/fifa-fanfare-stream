import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.4511e11a8de447e4a70b5a1b3e5d2aa8",
  appName: "fifa-fanfare-stream",
  webDir: "dist",
  server: {
    url: "https://4511e11a-8de4-47e4-a70b-5a1b3e5d2aa8.lovableproject.com?forceHideBadge=true",
    cleartext: true,
  },
  plugins: {
    // Native Google Sign-In (One Tap-style bottom sheet on Android, native
    // sheet on iOS). The client IDs here MUST come from your Google Cloud
    // OAuth credentials for each platform. Replace the placeholder values
    // after you export to GitHub and finish the platform setup below.
    GoogleAuth: {
      // Google Web OAuth Client ID — used by Android + iOS as the "server"
      // client so the returned ID token has Supabase's audience.
      clientId: "REPLACE_WITH_WEB_CLIENT_ID.apps.googleusercontent.com",
      // Optional: iOS-specific client ID from Google Cloud.
      iosClientId: "REPLACE_WITH_IOS_CLIENT_ID.apps.googleusercontent.com",
      scopes: ["profile", "email"],
      serverClientId: "REPLACE_WITH_WEB_CLIENT_ID.apps.googleusercontent.com",
      forceCodeForRefreshToken: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
