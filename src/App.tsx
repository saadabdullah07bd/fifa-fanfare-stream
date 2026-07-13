import { Routes, Route, NavLink, Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, lazy, Suspense, type ReactNode } from "react";
import {
  Home as HomeIcon,
  CalendarDays,
  Trophy,
  Newspaper,
  Tv,
  Settings as SettingsIcon,
} from "lucide-react";
import wc26Emblem from "@/assets/wc26-trophy.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useAuth";

// Home loads eagerly (the landing route); every other page is code-split so
// the initial JS bundle stays small on slower mobile connections. Heavy deps
// (hls.js/mpegts on LiveTV, recharts on Standings) now load only when needed.
import Home from "@/pages/Home";
const Fixtures = lazy(() => import("@/pages/Fixtures"));
const News = lazy(() => import("@/pages/News"));
const LiveTV = lazy(() => import("@/pages/LiveTV"));
const Settings = lazy(() => import("@/pages/Settings"));
const Auth = lazy(() => import("@/pages/Auth"));
const MatchDetail = lazy(() => import("@/pages/MatchDetail"));
const TeamDetail = lazy(() => import("@/pages/TeamDetail"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const Terms = lazy(() => import("@/pages/Terms"));
const Privacy = lazy(() => import("@/pages/Privacy"));
const Standings = lazy(() => import("@/pages/Standings"));
import { BottomTabs } from "@/components/BottomTabs";
import { AnimatePresence, motion } from "framer-motion";
import PageTransition from "@/components/PageTransition";
import OnboardingModal from "@/components/OnboardingModal";
import MobileSplash from "@/components/MobileSplash";
import GoogleOneTap from "@/components/GoogleOneTap";
import PushBootstrap from "@/components/PushBootstrap";

/**
 * Internal hook to manage auth session state within the App component.
 */
function useSession() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);
  return { ready, authed };
}

/**
 * Wrapper component to protect routes that require authentication.
 */
function RequireAuth({ children }: { children: ReactNode }) {
  const { ready, authed } = useSession();
  const location = useLocation();
  if (!ready) return <div className="p-12 text-center text-muted-foreground">Loading…</div>;
  if (!authed) return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

/**
 * Retrieves any pending post-auth redirect path from session storage.
 */
function getPendingAuthRedirect() {
  if (typeof window === "undefined") return null;
  const path = window.sessionStorage.getItem("postAuthRedirect");
  if (!path || !path.startsWith("/") || path.startsWith("//")) return null;
  return path;
}

/**
 * Component that handles redirection after a successful login based on stored state.
 */
function AuthRedirector() {
  const navigate = useNavigate();
  useEffect(() => {
    const redirect = () => {
      const path = getPendingAuthRedirect();
      if (!path) return;
      window.sessionStorage.removeItem("postAuthRedirect");
      navigate(path, { replace: true });
    };
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) redirect();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) setTimeout(redirect, 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);
  return null;
}

/**
 * Desktop navigation menu links.
 */
function Nav() {
  const items = [
    ["/", "Home"],
    ["/fixtures", "Fixtures"],
    ["/standings", "Standings"],
    ["/news", "News"],
  ] as const;
  return (
    <>
      {items.map(([to, label]) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          className={({ isActive }) =>
            `relative rounded-md px-3 py-2 text-sm font-semibold uppercase tracking-wider transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
              isActive ? "text-primary" : "text-foreground/80"
            }`
          }
        >
          {({ isActive }) => (
            <>
              {label}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-2 -bottom-[3px] h-[2px] rounded-full bg-primary"
                />
              )}
            </>
          )}
        </NavLink>
      ))}
    </>
  );
}

/**
 * Site footer — visible on all pages, with responsive layout.
 */
function SiteFooter() {
  const { pathname } = useLocation();
  if (pathname === "/live-tv" || pathname === "/auth") return null;
  return (
    <footer className="mt-8 hidden border-t border-border bg-card/40 py-8 lg:block">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-xs text-muted-foreground sm:flex-row">
        <p>© {new Date().getFullYear()} Pitch26 · Independent fan hub · Not affiliated with FIFA</p>
        <nav aria-label="Legal" className="flex items-center gap-4">
          <Link
            to="/terms"
            className="rounded hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Terms
          </Link>
          <Link
            to="/privacy"
            className="rounded hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Privacy
          </Link>
        </nav>
      </div>
    </footer>
  );
}

const MOBILE_TABS = [
  { to: "/", label: "Home", icon: HomeIcon },
  { to: "/fixtures", label: "Fixtures", icon: CalendarDays },
  { to: "/live-tv", label: "Live", icon: Tv, featured: true },
  { to: "/standings", label: "Table", icon: Trophy },
  { to: "/news", label: "News", icon: Newspaper },
];

/**
 * A soft, non-jarring loading state for lazily-loaded routes — a pulsing
 * wordmark instead of a bare "Loading…" so route splits feel intentional.
 */
function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <motion.span
        className="display text-2xl tracking-[0.3em] text-muted-foreground"
        animate={{ opacity: [0.35, 1, 0.35] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      >
        PITCH<span className="text-primary">26</span>
      </motion.span>
    </div>
  );
}

/**
 * Routes wrapped in AnimatePresence so page changes cross-fade/rise instead of
 * snapping. Keyed on the top-level path segment so param changes within a page
 * (e.g. /match/1 → /match/2) don't retrigger a full page transition.
 */
function AnimatedRoutes() {
  const location = useLocation();
  const key = "/" + (location.pathname.split("/")[1] ?? "");
  return (
    <AnimatePresence mode="wait" initial={false}>
      <PageTransition key={key}>
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/fixtures" element={<Fixtures />} />
          <Route path="/standings" element={<Standings />} />
          <Route path="/news" element={<News />} />
          <Route
            path="/live-tv"
            element={
              <RequireAuth>
                <LiveTV />
              </RequireAuth>
            }
          />
          <Route path="/predictions" element={<Navigate to="/" replace />} />
          <Route path="/match/:id" element={<MatchDetail />} />
          <Route path="/team/:name" element={<TeamDetail />} />
          <Route
            path="/settings"
            element={
              <RequireAuth>
                <Settings />
              </RequireAuth>
            }
          />
          <Route path="/auth" element={<Auth />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </PageTransition>
    </AnimatePresence>
  );
}

/**
 * Main application component that defines routing and layout.
 */
export default function App() {
  const { admin } = useIsAdmin();
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      {/* Skip to content link for keyboard/screen-reader users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-primary-foreground focus:shadow-lg"
      >
        Skip to content
      </a>

      <MobileSplash />
      <AuthRedirector />
      <GoogleOneTap />
      <PushBootstrap />
      <OnboardingModal />

      <header className="sticky top-0 z-40 glass-nav">
        <div className="tri-ribbon" aria-hidden="true" />
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <Link
            to="/"
            aria-label="Pitch26 home"
            className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <img
              src={wc26Emblem.url}
              alt=""
              aria-hidden="true"
              width={40}
              height={40}
              className="h-9 w-9 object-contain sm:h-10 sm:w-10"
            />
            <span className="display text-xl tracking-wider text-foreground sm:text-2xl">
              PITCH<span className="text-primary">26</span>
            </span>
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
            <Nav />
          </nav>

          <div className="flex items-center gap-2">
            {admin && (
              <>
                <Link
                  to="/settings"
                  aria-label="Admin settings"
                  className="hidden min-h-9 items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2 text-xs font-bold uppercase tracking-wider text-foreground/80 transition-colors hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:inline-flex"
                >
                  <SettingsIcon size={14} aria-hidden="true" /> Admin
                </Link>
                <Link
                  to="/settings"
                  aria-label="Admin settings"
                  className="grid h-10 w-10 place-items-center rounded-md border border-border bg-secondary text-foreground/80 transition-colors hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:hidden"
                >
                  <SettingsIcon size={16} aria-hidden="true" />
                </Link>
              </>
            )}
            <Link
              to="/live-tv"
              aria-label="Watch live"
              className="hidden min-h-10 items-center rounded-md bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:inline-flex"
            >
              <span className="live-dot mr-2 align-middle" aria-hidden="true" />
              Watch
            </Link>
            <Link
              to="/live-tv"
              aria-label="Watch live"
              className="grid h-10 w-10 place-items-center rounded-md bg-primary text-primary-foreground shadow transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:hidden"
            >
              <Tv size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content" className="flex-1 pb-safe-tabs lg:pb-0">
        <Suspense fallback={<RouteFallback />}>
          <AnimatedRoutes />
        </Suspense>
      </main>

      <SiteFooter />
      <BottomTabs tabs={MOBILE_TABS} accentColor="#e6b800" />
    </div>
  );
}
