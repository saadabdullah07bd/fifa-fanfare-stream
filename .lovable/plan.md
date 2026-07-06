## Pitch26 — full rewrite to Vite SPA + real data sources

### What changes

**Framework**
- Remove TanStack Start. Keep Vite + React 19 + Tailwind v4 + shadcn.
- Replace file-based routing with **React Router v6** (`BrowserRouter`).
- New entry: `src/main.tsx` → `<App />` with `<Routes>`.
- Delete `src/routes/`, `src/routeTree.gen.ts`, `src/router.tsx`, `src/server.ts`, `src/start.ts`, `src/lib/*.functions.ts`, `src/lib/*.server.ts`, `src/integrations/supabase/auth-*.ts`, `src/integrations/supabase/client.server.ts`, `src/routes/api/**`.
- SSR is gone. SEO uses `react-helmet-async` per route (worse than SSR head tags, but acceptable for a fan app).

**Backend → Supabase Edge Functions**
All server functions become Deno edge functions under `supabase/functions/`:

| Old server fn | New edge function |
|---|---|
| `xtream.functions.ts` (save/refresh/get stream URL) | `xtream-config`, `xtream-refresh`, `xtream-stream-url` |
| `user.functions.ts` (favorites, predictions) | `user-favorites`, `user-predictions` |
| `leaderboard.functions.ts` | `leaderboard` |
| `data.functions.ts` (home/matches/groups/teams/…) | **removed** — client reads Supabase directly with anon key + RLS |
| `refresh.functions.ts` | `refresh-data` (called by pg_cron only) |

Admin check (`saadabdullah07bvd@gmail.com`) stays server-side inside each privileged edge function using `has_role`.

**Data sources (replaces Firecrawl-only scraping)**
- **football-data.org** (competition `WC`): fixtures, results, standings, scorers, teams, venues. Structured JSON, no scraping. Key: `FOOTBALL_DATA_API_TOKEN` (already stored).
- **NewsAPI** (`everything?q=FIFA World Cup 2026`): news headlines + images. Key: `NEWSAPI_KEY` (already stored).
- **YouTube oEmbed** on the FIFA official channel: highlights (no key needed).
- **Firecrawl**: fallback only — venue photos + written highlight recaps when NewsAPI misses.

**Auto-refresh**
- Remove the "Refresh now" button and the Xtream refresh UI on admin settings (Xtream refresh stays, but no user-visible manual data refresh).
- `pg_cron` calls `refresh-data` **every hour** for fixtures/standings/scorers/news.
- Client polls the `matches` table via Supabase realtime for live scores (already-enabled RLS makes this safe).

### Route map (React Router)

```text
/                → Home (hero + live/next + top scorers + news)
/fixtures        → All matches
/groups          → Group tables
/knockouts       → Bracket
/teams           → Team grid
/teams/:code     → Team detail
/venues          → 16 host cities
/scorers         → Golden Boot
/news            → NewsAPI headlines
/highlights      → NEW — YouTube embeds + Firecrawl recap fallback
/live-tv         → Xtream channel grid (auth required)
/live-tv/:id     → HLS player
/predictions     → Predictions + leaderboard (auth required)
/favorites       → Favorite teams (auth required)
/settings        → Admin-only Xtream config (auth + role gate)
/auth            → Google login
```

Auth gate = a `<RequireAuth>` wrapper component that checks `supabase.auth.getSession()`, redirects to `/auth` if missing.

### Files created

- `src/App.tsx` — router shell + nav
- `src/main.tsx` — rewritten entry
- `src/components/RequireAuth.tsx`, `src/components/RequireAdmin.tsx`
- `src/hooks/useAuth.ts`, `src/hooks/useMatches.ts` (realtime), `src/hooks/use-*-query.ts` for each data read
- `src/lib/api/xtream.ts`, `src/lib/api/user.ts`, `src/lib/api/leaderboard.ts` — thin wrappers that `supabase.functions.invoke(...)` the edge functions
- `src/pages/*.tsx` — one file per route (moved from `src/routes/*.tsx`, stripped of TanStack code)
- `supabase/functions/{xtream-config,xtream-refresh,xtream-stream-url,user-favorites,user-predictions,leaderboard,refresh-data}/index.ts`

### Files deleted

Everything under `src/routes/`, `src/lib/*.functions.ts`, `src/lib/*.server.ts`, `src/lib/firecrawl.server.ts`, `src/integrations/supabase/auth-attacher.ts`, `src/integrations/supabase/auth-middleware.ts`, `src/integrations/supabase/client.server.ts`, `src/server.ts`, `src/start.ts`, `src/router.tsx`, `src/routeTree.gen.ts`, `vite.config.ts` TanStack plugins.

### Migrations

One new migration:
- Enable `pg_cron` + `pg_net` (if not already).
- Schedule hourly job hitting the `refresh-data` edge function with anon key.
- Enable realtime on `public.matches` for live scoreline updates.

### Technical details (for reference)

- `vite.config.ts` reduced to React plugin + path alias. No `@tanstack/router-plugin`, no `nitro`.
- `package.json` remove: `@tanstack/react-start`, `@tanstack/react-router`, `@tanstack/react-router-devtools`, `@tanstack/router-plugin`. Add: `react-router-dom`, `react-helmet-async`.
- Edge functions store secrets via Supabase (not `process.env` — they use `Deno.env.get`). NEWSAPI_KEY, FOOTBALL_DATA_API_TOKEN, FIRECRAWL_API_KEY need to be added as Supabase edge function secrets too (they're currently only Lovable-runtime).
- Xtream credentials keep living in the `xtream_config` table (already there), read by edge functions with service role.

### Trade-offs you're accepting

1. **No SSR** → slower first paint, weaker OG/Twitter previews (Helmet writes tags after JS runs; some crawlers won't wait).
2. **Still not a Node.js app** — Vite build output is static HTML/JS/CSS. Hostinger's Node.js hosting can't run it. You'd upload `dist/` to Hostinger **static** hosting, or keep publishing via Lovable.
3. **All backend runs on Supabase Edge Functions** — you're now paying/rate-limited on Supabase's function invocations instead of Lovable's edge.
4. **Rebuild time** — ~30 files touched, one migration, ~7 new edge functions. Higher chance of a broken step needing follow-up fixes.
5. **The manual refresh button goes away** — data updates hourly. If football-data.org is slow to publish a result, users wait up to 60 min. Realtime scores during a live match still poll every ~30s.

### Order I'll build in

1. Add edge-function secrets (NEWSAPI_KEY, FOOTBALL_DATA_API_TOKEN, FIRECRAWL_API_KEY) to Supabase.
2. Write all 7 edge functions.
3. Migration: pg_cron hourly job + realtime on matches.
4. Rewrite `vite.config.ts` + `package.json` + `src/main.tsx` + `src/App.tsx`.
5. Port every route to `src/pages/` as plain React components using React Router.
6. Wire auth gate + admin gate.
7. Delete TanStack scaffolding.
8. Smoke-test: home, fixtures, auth, admin settings, live TV.

### Confirm before I start

- [ ] You accept SSR loss + Hostinger will still not run this as a "Node.js app".
- [ ] You're OK with all backend moving to Supabase Edge Functions (billing/limits shift).
- [ ] Remove the refresh button entirely (hourly auto only), or keep an admin-only "force refresh" button?
