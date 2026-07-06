import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import "@fontsource/bebas-neue/400.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/700.css";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="display text-7xl text-primary">404</h1>
        <p className="mt-4 text-muted-foreground">Off the pitch. This page doesn't exist.</p>
        <Link to="/" className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Back to the tournament
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="display text-3xl text-foreground">Match paused</h1>
        <p className="mt-2 text-sm text-muted-foreground">Something went wrong. Try again.</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >Retry</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Pitch26 — FIFA World Cup 2026 hub" },
      { name: "description", content: "Live fixtures, groups, standings, top scorers, host venues and match streaming for the 2026 FIFA World Cup across USA, Canada & Mexico." },
      { property: "og:title", content: "Pitch26 — FIFA World Cup 2026" },
      { property: "og:description", content: "Live fixtures, standings, and match streaming for FIFA World Cup 2026." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function NavLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="px-3 py-2 text-sm font-semibold uppercase tracking-wider text-foreground/80 transition-colors hover:text-primary"
      activeProps={{ className: "text-primary border-b-2 border-primary" }}
      activeOptions={{ exact: to === "/" }}
    >
      {children}
    </Link>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
            <Link to="/" className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground display text-xl">26</span>
              <span className="display text-2xl tracking-wider text-foreground">PITCH<span className="text-primary">26</span></span>
            </Link>
            <nav className="hidden items-center gap-1 lg:flex">
              <NavLink to="/">Home</NavLink>
              <NavLink to="/fixtures">Fixtures</NavLink>
              <NavLink to="/groups">Groups</NavLink>
              <NavLink to="/teams">Teams</NavLink>
              <NavLink to="/scorers">Scorers</NavLink>
              <NavLink to="/venues">Venues</NavLink>
              <NavLink to="/predictions">Predict</NavLink>
              <NavLink to="/favorites">Favorites</NavLink>
              <NavLink to="/news">News</NavLink>
              <NavLink to="/live-tv">Live TV</NavLink>
            </nav>
            <Link to="/live-tv" className="rounded-md bg-accent px-3 py-2 text-xs font-bold uppercase tracking-wider text-accent-foreground">
              <span className="live-dot mr-2 align-middle" />Watch
            </Link>
          </div>
          <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2 lg:hidden">
            <NavLink to="/">Home</NavLink>
            <NavLink to="/fixtures">Fixtures</NavLink>
            <NavLink to="/groups">Groups</NavLink>
            <NavLink to="/teams">Teams</NavLink>
            <NavLink to="/scorers">Scorers</NavLink>
            <NavLink to="/venues">Venues</NavLink>
            <NavLink to="/predictions">Predict</NavLink>
            <NavLink to="/favorites">Favorites</NavLink>
            <NavLink to="/news">News</NavLink>
            <NavLink to="/live-tv">Live TV</NavLink>
          </nav>
        </header>
        <main>
          <Outlet />
        </main>
        <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
          Pitch26 · Independent fan hub · Not affiliated with FIFA
        </footer>
      </div>
    </QueryClientProvider>
  );
}
