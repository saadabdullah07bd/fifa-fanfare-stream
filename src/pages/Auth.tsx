import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/lib/seo";
import { toast } from "sonner";
import { getAppConfig } from "@/lib/appConfig";

/**
 * Auth page component handling Google OAuth sign-in and session redirection.
 * On web: uses Supabase's signInWithOAuth redirect flow.
 * On Capacitor native (Android/iOS): uses the native Google Sign-In SDK
 * (One Tap-style bottom sheet) and exchanges the ID token with Supabase.
 */

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromState = (location.state as { from?: string } | null)?.from;
  const from = typeof fromState === "string" && fromState.startsWith("/") && fromState !== "/auth" ? fromState : "/live-tv";

  useEffect(() => {
    // If already signed in, go straight to intended destination (Live by default).
    supabase.auth.getSession().then(({ data }) => { if (data.session) navigate(from, { replace: true }); });
  }, [from, navigate]);

  /** Initiates Google OAuth sign-in. On Capacitor native we use the native
   *  Google Sign-In SDK for a real "One Tap" style bottom sheet; on the web we
   *  fall back to Supabase's redirect-based OAuth. */
  async function google() {
    try {
      const capCore = await import("@capacitor/core").catch(() => null);
      if (capCore?.Capacitor?.isNativePlatform?.()) {
        const { GoogleAuth } = await import("@codetrix-studio/capacitor-google-auth");
        const cfg = await getAppConfig();
        await GoogleAuth.initialize({
          clientId: cfg.googleClientId,
          scopes: ["profile", "email"],
          grantOfflineAccess: false,
        });
        const result = await GoogleAuth.signIn();
        const idToken = result.authentication?.idToken;
        if (!idToken) throw new Error("Google did not return an ID token");
        const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token: idToken });
        if (error) throw error;
        return;
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (e) {
      toast.error((e as Error).message);
    }
  }


  return (
    <div className="mx-auto max-w-md px-4 py-24">
      <Seo title="Sign in — Pitch26" />
      <Link to="/auth" className="text-xs uppercase tracking-wider text-muted-foreground hover:text-primary" aria-hidden="true">Pitch26</Link>
      <h1 className="display mt-4 text-5xl">Sign in</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Sign in with Google to access Pitch26 — save favorite teams, submit predictions, and stream live matches.
      </p>

      {/*
        Google-branded sign-in button.
        Follows Google Identity branding guidelines: white background, #dadce0 border,
        Roboto/Medium 14sp label "Sign in with Google", official 4-color "G" mark, 40dp height.
        https://developers.google.com/identity/branding-guidelines
      */}
      <button
        type="button"
        onClick={() => { window.sessionStorage.setItem("postAuthRedirect", from); google(); }}
        aria-label="Sign in with Google"
        className="mt-8 flex w-full items-center justify-center gap-3 rounded-md border bg-white px-4 text-sm font-medium text-[#1f1f1f] shadow-sm transition hover:bg-[#f8f9fa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4285F4] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        style={{ height: 40, borderColor: "#dadce0", fontFamily: "'Roboto', system-ui, sans-serif", letterSpacing: 0.25 }}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.46c-.28 1.48-1.13 2.74-2.4 3.58v2.98h3.87c2.26-2.09 3.56-5.17 3.56-8.8z"/>
          <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-2.98c-1.07.72-2.44 1.16-4.06 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/>
          <path fill="#FBBC05" d="M5.28 14.31c-.24-.72-.38-1.49-.38-2.31s.14-1.59.38-2.31V6.6H1.29A11.996 11.996 0 000 12c0 1.94.46 3.78 1.29 5.4l3.99-3.09z"/>
          <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.6l3.99 3.09C6.23 6.86 8.88 4.75 12 4.75z"/>
        </svg>
        <span>Sign in with Google</span>
      </button>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        We only use your Google account to sign you in. We request access to your name, email address, and profile picture.
      </p>

      {/* Visible Terms & Privacy links — required by Google OAuth branding & verification policy. */}
      <p className="mt-4 text-center text-xs text-muted-foreground">
        By continuing, you agree to our{" "}
        <Link to="/terms" className="underline underline-offset-2 hover:text-primary">Terms of Service</Link>{" "}
        and{" "}
        <Link to="/privacy" className="underline underline-offset-2 hover:text-primary">Privacy Policy</Link>.
      </p>
    </div>
  );
}

