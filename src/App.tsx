import { Routes, Route, NavLink, Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
import { Home as HomeIcon, CalendarDays, Trophy, Newspaper, Tv } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Home from "@/pages/Home";
import Fixtures from "@/pages/Fixtures";
import News from "@/pages/News";
import LiveTV from "@/pages/LiveTV";
import Predictions from "@/pages/Predictions";
import Settings from "@/pages/Settings";
import Auth from "@/pages/Auth";
import MatchDetail from "@/pages/MatchDetail";
import TeamDetail from "@/pages/TeamDetail";
import NotFound from "@/pages/NotFound";
import Terms from "@/pages/Terms";
import Privacy from "@/pages/Privacy";
import Standings from "@/pages/Standings";
import { BottomTabs } from "@/components/BottomTabs";
import OnboardingModal from "@/components/OnboardingModal";

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

function RequireAuth({ children }: { children: ReactNode }) {
  const { ready, authed } = useSession();
  const location = useLocation();
  if (!ready) return <div className="p-12 text-center text-muted-foreground">Loading…</div>;
  if (!authed) return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function getPendingAuthRedirect() {
  if (typeof window === "undefined") return null;
  const path = window.sessionStorage.getItem("postAuthRedirect");
  if (!path || !path.startsWith("/") || path.startsWith("//")) return null;
  return path;
}

function AuthRedirector() {
  const navigate = useNavigate();
  useEffect(() => {
    const redirect = () => {
      const path = getPendingAuthRedirect();
      if (!path) return;
      window.sessionStorage.removeItem("postAuthRedirect");
      navigate(path, { replace: true });
    };
    supabase.auth.getSession().then(({ data }) => { if (data.session) redirect(); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => { if (session) setTimeout(redirect, 0); });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);
  return null;
}

function Nav() {
  const items = [
    ["/", "Home"], ["/fixtures", "Fixtures"],
    ["/standings", "Standings"],
    ["/predictions", "Predict"],
    ["/news", "News"], ["/live-tv", "Live TV"],
  ] as const;
  return (
    <>
      {items.map(([to, label]) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          className={({ isActive }) =>
            `px-3 py-2 text-sm font-semibold uppercase tracking-wider transition-colors hover:text-primary ${
              isActive ? "text-primary border-b-2 border-primary" : "text-foreground/80"
            }`
          }
        >{label}</NavLink>
      ))}
    </>
  );
}

const MOBILE_TABS = [
  { to: "/", label: "Home", icon: HomeIcon },
  { to: "/fixtures", label: "Knockout", icon: CalendarDays },
  { to: "/standings", label: "Table", icon: Trophy },
  { to: "/news", label: "News", icon: Newspaper },
  { to: "/live-tv", label: "Live", icon: Tv },
];


export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AuthRedirector />
      <OnboardingModal />
      <header className="sticky top-0 z-40 glass-nav">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground display text-xl">26</span>
            <span className="display text-2xl tracking-wider text-foreground">PITCH<span className="text-primary">26</span></span>
          </Link>
          <nav className="hidden items-center gap-1 lg:flex"><Nav /></nav>
          <Link to="/live-tv" className="hidden lg:inline-flex glass-pill px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-white/20 transition-colors">
            <span className="live-dot mr-2 align-middle" />Watch
          </Link>
        </div>
      </header>
      <main className="pb-24 lg:pb-0">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/fixtures" element={<Fixtures />} />
          <Route path="/standings" element={<Standings />} />
          <Route path="/news" element={<News />} />
          <Route path="/live-tv" element={<RequireAuth><LiveTV /></RequireAuth>} />
          <Route path="/predictions" element={<Predictions />} />
          <Route path="/match/:id" element={<MatchDetail />} />
          <Route path="/team/:name" element={<TeamDetail />} />
          <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="glass-nav mt-8 py-8 pb-24 text-center text-xs text-muted-foreground lg:pb-8">
        Pitch26 · Independent fan hub · Not affiliated with FIFA
      </footer>
      <BottomTabs tabs={MOBILE_TABS} accentColor="#e6b800" />
    </div>
  );
}
