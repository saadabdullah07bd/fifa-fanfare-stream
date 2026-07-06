## Goal

A FIFA World Cup 2026 fan app with:
1. Stats hub (groups, standings, fixtures, results, top scorers, teams, venues, news + images).
2. Live TV tab that connects to your Xtream Codes server and shows **only** the "FIFA World Cup 2026" and "Cricket" categories.
3. Data auto-refreshed every hour via Firecrawl scraping; live matches refresh every ~30s while in-play.

## Design direction (proposed — I'll build one look; say the word if you want alternatives)

- **Palette:** Deep pitch-green `#0B3D2E` base, chalk-white `#F5F1E8`, tri-nation accent trio (USA red `#B31942`, Canada red `#D52B1E`, Mexico green `#006847`), signal-gold `#F5B301` for live/highlights.
- **Type:** Bold display (Anton / Bebas-style condensed) for scores + team names, Inter for body.
- **Feel:** Broadcast scoreboard energy — big score digits that flip on update, subtle shimmer bar on live matches, dense group tables, hero switches to live scoreboard when a match is on.

## Architecture

- **Backend:** Lovable Cloud (Postgres + Auth + Storage + server functions).
- **Frontend:** TanStack Start (already scaffolded).
- **Scraping:** Firecrawl connector for FIFA.com, Wikipedia WC 2026 page, and one live-score source (e.g. flashscore/livescore mirror or FIFA fixtures endpoint).
- **IPTV:** Xtream Codes credentials stored as secrets; server function proxies `player_api.php` calls to avoid CORS and keep credentials off the client.

## Data model (Cloud tables)

- `teams` (id, name, code, group, flag_url, confederation)
- `venues` (id, name, city, country, capacity, image_url)
- `matches` (id, stage, group, date_utc, home_team, away_team, home_score, away_score, status: scheduled|live|ft, minute, venue_id)
- `standings` (group, team_id, played, w, d, l, gf, ga, gd, pts)
- `scorers` (team_id, player, goals, assists)
- `news` (id, title, source, url, image_url, published_at, summary)
- `channels` (id, category: 'wc2026'|'cricket', name, logo_url, stream_url, epg_id) — cached list, refreshed on demand from Xtream
- `scrape_runs` (source, last_run_at, status) — dedupe hourly jobs

RLS: public read on stats tables; `channels` and any user data behind auth.

## Server functions

- `refreshFixtures`, `refreshStandings`, `refreshScorers`, `refreshTeams`, `refreshNews` — Firecrawl scrape + upsert. Triggered hourly.
- `refreshLiveMatches` — runs every 30s (client-side polling of a lightweight server fn) only when at least one match is `live`.
- `refreshXtreamChannels` — calls Xtream `get_live_categories` + `get_live_streams`, keeps only categories whose name matches `/world cup|fifa|wc.?2026/i` or `/cricket/i`, upserts into `channels`.
- `getStreamUrl(channelId)` — returns the signed Xtream `.m3u8` URL for the player (kept server-side so raw creds never ship).

### Hourly schedule

TanStack server route at `/api/public/cron/refresh-all` protected by an HMAC secret, called by pg_cron every hour. On the same endpoint we fan out the refresh functions.

## Routes

- `/` — Home: live/next match hero, today's fixtures, group of the day, top scorers strip, latest news.
- `/fixtures` — full schedule, filter by date/team/stage.
- `/groups` — all 12 groups with standings.
- `/knockouts` — bracket once group stage ends.
- `/teams/$code` — squad, fixtures, venue map.
- `/venues` — 16 host cities with photos.
- `/scorers` — Golden Boot table.
- `/news` — scraped headlines with images.
- `/live-tv` — two tabs (World Cup / Cricket), channel grid, click opens player.
- `/live-tv/$channelId` — HLS player (hls.js) with EPG.
- `/settings` — Xtream server connect form (auth-gated).

## Xtream integration

1. On first launch, `/settings` asks for `host`, `username`, `password`. Stored as Cloud secrets, not in the DB.
2. `refreshXtreamChannels` filters to WC 2026 + Cricket categories only — everything else is dropped, never surfaced.
3. Player uses `hls.js` for `.m3u8`. Optional VOD/EPG later.

## Secrets needed

- `FIRECRAWL_API_KEY` (via Firecrawl connector)
- `XTREAM_HOST`, `XTREAM_USER`, `XTREAM_PASS` (you'll paste when prompted)
- `CRON_SECRET` (auto-generated) for the refresh endpoint

## Suggestions (things worth adding)

- **Favorite teams + push-style toast reminders** 30 min before kickoff.
- **Group prediction game** — pick winners, leaderboard among signed-in users.
- **Match center**: lineups, timeline of goals/cards, xG if the scraped source has it.
- **Highlights embed** from YouTube FIFA channel (oEmbed, no scraping).
- **Offline-first fixtures** via service worker so schedules work on flaky stadium Wi-Fi.
- **Multi-language** (EN / ES / FR — the three host-country languages).

## Build order

1. Enable Lovable Cloud + Firecrawl connector, create schema + RLS + grants.
2. Design system tokens + shell layout + nav.
3. Scrape functions + hourly cron + seed with current WC 2026 qualified teams.
4. Home, Fixtures, Groups, Teams, Scorers, Venues, News pages.
5. Live match polling.
6. Settings → Xtream connect → channel refresh → Live TV tabs + HLS player.
7. Auth (email + Google) for favorites/predictions.
8. Polish, SEO head tags per route, publish.

## Open items before build

- Confirm palette/type direction above, or ask for 3 rendered options.
- Confirm auth: email + Google by default — ok?
- You'll provide Xtream `host / user / pass` after Cloud is enabled.