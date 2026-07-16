import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.muhammadsaadabdullah.pitch26",
  appName: "Pitch26",
  webDir: "dist",
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
      // Black + trophy gold, matching the web app's identity.
      backgroundColor: "#000000",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: true,
      androidSpinnerStyle: "large",
      spinnerColor: "#d4af37",
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
