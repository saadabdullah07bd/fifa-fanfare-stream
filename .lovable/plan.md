
# Pitch26 — Complete SEO Plan

Goal: get Pitch26 indexed on the correct project domain (`https://fifa-fanfare-stream.lovable.app`), fix every scanner finding, and ship the per-route metadata, structured data, and performance foundations a live-scores site needs.

Current problems the scanner and code review found:
- `robots.txt`, `sitemap.xml`, and `og:url` all point at wrong/stale domains (`pitch26.drmabari.com`, `pitch26.muhammadsaadabdullah.com`).
- Sitemap lists routes that don't exist (`/groups`, `/teams`, `/scorers`, `/venues`, `/highlights`) and misses real ones (`/standings`, `/news`, `/live-tv`, `/match/:id`, `/team/:name`).
- No per-route `<title>`/`description`/`canonical`/`og:*` — Home has good static tags but every other route inherits them, so Google sees one page.
- `TeamDetail` fallback description is under 50 chars.
- No `/llms.txt` for AI assistants.
- LCP hero image is not preloaded; no explicit dimensions on several images → layout shift.
- Match detail page missing an H1 and some inputs miss accessible labels.
- No Google Search Console verification / sitemap submission.

---

## Phase 1 — Fix the domain drift (blocks everything else)

1. `public/robots.txt` → `Sitemap: https://fifa-fanfare-stream.lovable.app/sitemap.xml`.
2. Migrate `public/sitemap.xml` (hand-edited, out of sync) to a generated one:
   - Add `scripts/generate-sitemap.ts` with `BASE_URL = "https://fifa-fanfare-stream.lovable.app"`.
   - Static entries: `/`, `/fixtures`, `/standings`, `/news`, `/live-tv`, `/terms`, `/privacy`.
   - Dynamic: one entry per row in `matches` (`/match/:external-id`) and per distinct team code (`/team/:name`). Fetched via Supabase using the anon key at build time.
   - Wire `predev` + `prebuild` in `package.json` to run it.
3. `index.html`: remove the hardcoded `og:url` (per-route Helmet takes over). Keep sitewide title/description as fallback.

## Phase 2 — Per-route metadata (Helmet)

`react-helmet-async` and `Seo` component already exist. Audit and fix each route so `title`, `meta description`, `canonical`, `og:title`, `og:description`, `og:url`, `twitter:*` all self-reference:

- `/` — done, keep.
- `/fixtures` — "2026 World Cup knockout bracket — Pitch26"; description names semi-finals + final.
- `/standings` — "World Cup 2026 group standings & top scorers — Pitch26".
- `/news` — "World Cup 2026 news & live headlines — Pitch26".
- `/live-tv` — noindex (auth-gated, personal content).
- `/match/:id` — dynamic: `"{Home} vs {Away} — {stage} · Pitch26"`, description built from teams + kickoff time. Add `SportsEvent` JSON-LD per match.
- `/team/:name` — dynamic: `"{Team} at the 2026 FIFA World Cup — Pitch26"`; rewrite fallback description to 120–150 chars mentioning Pitch26 + tournament so it clears the 50-char minimum.
- `/terms`, `/privacy` — real titles + noindex is optional.

Add `BreadcrumbList` JSON-LD on `/fixtures`, `/match/:id`, `/team/:name`.

## Phase 3 — AI readiness

Create `public/llms.txt`:

```
# Pitch26

> Independent fan hub for the 2026 FIFA World Cup — live fixtures, standings, top scorers, and news.

## Pages
- [Home](/): Live scores and today's fixtures.
- [Knockout](/fixtures): Semi-finals and final bracket.
- [Standings](/standings): Group tables + top scorers.
- [News](/news): Headlines refreshed hourly.
```

Exclude `/live-tv`, `/auth`, `/settings`, `/match/*`, `/team/*` (dynamic; keep the file short).

## Phase 4 — Performance (fixes Lighthouse finding)

- Preload the hero image: `<link rel="preload" as="image" href="/src/assets/hero-stadium.jpg" fetchpriority="high">` (or import + preload the built asset).
- On `Home.tsx` `<img src={heroImg}>`: add explicit `width`/`height` and `fetchpriority="high"`, remove any `loading="lazy"`.
- On news/fixture cards: ensure every `<img>` has `width`/`height` or an `aspect-*` wrapper (mostly already there).
- Add `font-display: swap` to the custom `@font-face` in `src/styles.css`.

## Phase 5 — Accessibility & content (fixes `agent_content` finding)

- `MatchDetail.tsx`: add a single `<h1>` (e.g. "{Home} vs {Away}") near the top of the page.
- Volume slider `<input type="range">` and any unlabeled `<input>` in `LiveTV` / `Settings` get `aria-label`.
- Wrap each route's primary content in exactly one `<main>` (currently `App.tsx` uses `<main>` — verify no nested `<main>` in child pages).
- Any icon-only `<button>` gets `aria-label`.

## Phase 6 — Google Search Console

1. Connect via `standard_connectors--connect` for `google_search_console`.
2. Request a META verification token for `https://fifa-fanfare-stream.lovable.app/`.
3. Drop the returned `<meta name="google-site-verification" content="…">` into `index.html`, publish.
4. Call the verify endpoint, then add the property and submit `/sitemap.xml`.

## Phase 7 — Off-page (ongoing)

- Publish the site (required — Semrush and GSC only see live URLs).
- After ~2 weeks of indexing, run `semrush--domain_analysis` on `fifa-fanfare-stream.lovable.app` and `semrush--serp_analysis` on target terms ("world cup 2026 fixtures", "world cup 2026 standings", "world cup 2026 top scorers") to see where the pages land and what to double down on.
- Link from any existing social profiles to seed crawl discovery.

---

## What ships in code (Phases 1–5)

- `public/robots.txt` — corrected Sitemap directive.
- `public/sitemap.xml` — replaced by generator output.
- `scripts/generate-sitemap.ts` — new; queries Supabase for match + team rows.
- `package.json` — new `predev` / `prebuild` scripts.
- `index.html` — drop `og:url`, keep the rest.
- `src/lib/seo.tsx` — ensure canonical + og:url self-reference the current route.
- `src/pages/Fixtures.tsx`, `Standings.tsx`, `News.tsx`, `MatchDetail.tsx`, `TeamDetail.tsx`, `LiveTV.tsx` — per-route `<Seo>` calls; MatchDetail also gets `<h1>` + `SportsEvent` JSON-LD; TeamDetail fallback description extended.
- `src/pages/Home.tsx` — hero `<img>` gets width/height + `fetchpriority`.
- `src/styles.css` — `font-display: swap`.
- `public/llms.txt` — new.

Phase 6 (GSC) needs one round-trip through the connector + a publish; Phase 7 is post-launch measurement, not code.

Approve and I'll ship Phases 1–5 in one pass, then run the GSC verification flow.
