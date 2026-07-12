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
    GoogleAuth: {
      clientId: "605493499383-f5runf6j81go1b08cvgt1j03iesiqbij.apps.googleusercontent.com",
      serverClientId: "605493499383-f5runf6j81go1b08cvgt1j03iesiqbij.apps.googleusercontent.com",
      scopes: ["profile", "email"],
      forceCodeForRefreshToken: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    SplashScreen: {
      // Show a branded splash for ~2.5s while the web bundle boots, then fade.
      launchShowDuration: 2500,
      launchAutoHide: true,
      launchFadeOutDuration: 350,
      backgroundColor: "#0B1220",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: true,
      androidSpinnerStyle: "large",
      spinnerColor: "#22C55E",
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
