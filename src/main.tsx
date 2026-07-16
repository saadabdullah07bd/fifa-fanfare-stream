import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "sonner";
import App from "./App";
import ConfigError from "./components/ConfigError";
import "./styles.css";
import "@fontsource/bebas-neue/400.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/700.css";
import { installTamperGuard } from "./lib/tamper-guard";
import { Capacitor } from "@capacitor/core";

// Install security protections for the application.
installTamperGuard();

// Hide the native Android splash screen once the web bundle has mounted.
// Configured in capacitor.config.ts (launchShowDuration ~2.5s).
if (Capacitor.isNativePlatform()) {
  import("@capacitor/splash-screen")
    .then(({ SplashScreen }) => {
      // Give the first paint a moment, then fade out.
      window.setTimeout(() => SplashScreen.hide({ fadeOutDuration: 350 }).catch(() => {}), 800);
    })
    .catch(() => {});
}

/**
 * Configure React Query client with persistence and caching policies.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep data considered "fresh" for 2 minutes so pages render instantly
      // from cache instead of showing a spinner every navigation.
      staleTime: 2 * 60_000,
      gcTime: 24 * 3600_000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    },
  },
});

/**
 * Create a persister to save the query cache in localStorage.
 * This allows returning users to see content instantly.
 */
const persister = createSyncStoragePersister({
  storage: typeof window !== "undefined" ? window.localStorage : undefined,
  key: "pitch26-query-cache",
  throttleTime: 1000,
});

const root = document.getElementById("root")!;
const configured =
  !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Initialize the React root and render the application.
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    {configured ? (
      <HelmetProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{ persister, maxAge: 24 * 3600_000, buster: "v2" }}
        >
          <BrowserRouter>
            <App />
            <Toaster
              position="top-center"
              richColors={false}
              toastOptions={{
                unstyled: false,
                classNames: {
                  toast:
                    "glass-toast !bg-white/10 !text-white !border !border-white/20 !backdrop-blur-2xl !shadow-2xl !rounded-2xl",
                  title: "!text-white !font-semibold",
                  description: "!text-white/80",
                  actionButton: "!bg-white/20 !text-white",
                  cancelButton: "!bg-white/10 !text-white",
                },
              }}
            />
          </BrowserRouter>
        </PersistQueryClientProvider>
      </HelmetProvider>
    ) : (
      <ConfigError />
    )}
  </React.StrictMode>,
);
