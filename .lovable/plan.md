
# Google One Tap + FCM Push Notifications

Two independent systems built on top of the existing Supabase auth and favorites tables. Both target: web browser, Android APK, and iOS (via Capacitor).

## 1. Google One Tap sign-in

### Web (browser)
- Add Google Identity Services script (`accounts.google.com/gsi/client`) in `index.html`.
- New `<GoogleOneTap />` component mounted globally in `App.tsx`, shown only when the user is signed-out and not currently on `/auth`. It:
  - Renders the One Tap iframe with your OAuth **Web Client ID**.
  - On credential callback, calls `supabase.auth.signInWithIdToken({ provider: 'google', token: credential, nonce })`.
  - Uses a cryptographic nonce (generated + hashed with SHA-256) as required by Supabase for ID-token sign-in.
- Keep the existing `/auth` page's popup button as a fallback.

### Android + iOS (Capacitor)
- Install `@capacitor-community/generic-oauth2` (works cross-platform) **or** `@codetrix-studio/capacitor-google-auth` for native Google Sign-In.
- Recommend `@codetrix-studio/capacitor-google-auth` — it uses the native Google Sign-In SDK on Android (One Tap-style bottom sheet) and native `ASWebAuthenticationSession` on iOS.
- Configure with the same Web Client ID + platform-specific client IDs (Android, iOS).
- On native platforms, the app calls `GoogleAuth.signIn()` and passes the resulting `idToken` to `supabase.auth.signInWithIdToken(...)`.

### Required from you
- Google Cloud **Web OAuth Client ID** (already exists — you set up Google auth earlier).
- Google Cloud **Android OAuth Client ID** (SHA-1 fingerprint of your keystore).
- Google Cloud **iOS OAuth Client ID** (bundle identifier).
- Add `http://localhost` and your published domain to Authorized JavaScript origins for the Web client (One Tap requirement).

## 2. Firebase Cloud Messaging push notifications

### Data model (new tables)
- `push_tokens (id, user_id, token, platform ['web'|'android'|'ios'], created_at, last_seen_at, unique(token))`
  - RLS: users can insert/select/delete only their own tokens.
- `notification_log (id, user_id, type, match_no, title, body, sent_at)` — dedupe key so we don't double-send.

### Web push
- Add Firebase SDK (`firebase/app`, `firebase/messaging`).
- New `public/firebase-messaging-sw.js` service worker (kept outside the app-shell PWA rules — messaging workers are exempt).
- On sign-in: request `Notification.permission`, get an FCM token via `getToken({ vapidKey })`, upsert into `push_tokens`.
- Foreground messages surfaced via `sonner` toast.

### Native push (Capacitor)
- Install `@capacitor/push-notifications` + `@capacitor-firebase/messaging`.
- On app start (after auth): register, listen for `registration` event, upsert the FCM token with platform `'android'` or `'ios'`.
- iOS also needs APNs auth key uploaded to Firebase Console → Cloud Messaging.

### Backend (edge functions + cron)
Four edge functions, all called by `pg_cron`:

1. **`push-kickoff-reminders`** (runs every 5 min): finds matches starting in 5–10 min; for each match, finds users whose `favorites.team_code` matches either side; sends "⚽ Argentina vs France kicks off in 10 min" to their FCM tokens.
2. **`push-goal-events`** (runs every 1 min): compares latest `matches.home_score` / `away_score` snapshot vs previous snapshot cached in a new `match_score_snapshots` table; sends "GOAL! Messi 42' — Argentina 1–0 France" to fans of either team.
3. **`push-final-results`** (runs every 5 min): finds matches whose status just flipped to `finished`; sends the final score.
4. **`push-news-headlines`** (runs every 10 min): finds `news` rows created since last run marked `flash: true`; sends the headline. Targets everyone with `notifications_news_optin = true` on their profile — since favorites-only was chosen, we'll gate news by a simple profile toggle so users can opt-in.

Each function uses FCM HTTP v1 API with a service account key. Dead tokens (410 / `UNREGISTERED`) are removed automatically.

### Required from you
- Firebase **Web app config** (`apiKey`, `authDomain`, `projectId`, `messagingSenderId`, `appId`) — safe to paste into code, they're publishable.
- Firebase **VAPID key** (for web push) — paste into secrets form.
- Firebase **Service Account JSON** (for server-side FCM sending from edge functions) — paste into secrets form as `FIREBASE_SERVICE_ACCOUNT`.
- Firebase **`google-services.json`** (Android) and **`GoogleService-Info.plist`** (iOS) — I'll tell you where to drop them once you export to GitHub.

## Rollout order

1. **DB migration** — `push_tokens`, `notification_log`, `match_score_snapshots`, plus `profiles.notifications_news_optin` column.
2. **Secrets** — request Firebase VAPID key + service account JSON via the secure form.
3. **Web One Tap** — component + `index.html` script + Supabase `signInWithIdToken` wiring.
4. **Web FCM** — service worker + token registration + settings toggle in `/settings`.
5. **Edge functions (4)** + cron schedule.
6. **Capacitor setup** — one-time install + `capacitor.config.ts` if not present; native plugin install; native Google Sign-In wiring; native push registration. You then export to GitHub, run `npx cap add android`/`ios`, drop the platform config files, and build.

## Technical notes

- Supabase `signInWithIdToken` requires an unhashed nonce sent to Google and the same nonce passed to Supabase; the client hashes it (SHA-256) before passing to Google.
- FCM web tokens are per-browser-per-origin; native tokens are per-install. Storing both in one table keyed by `(user_id, token)` is fine.
- Cron uses `pg_cron` + `pg_net` from Supabase — I'll write these via the `insert` tool (contains project URL + anon key) rather than a migration.
- One Tap does not appear in Lovable's iframe preview (Google blocks iframe origins). Test on the published URL.

## What I won't do this turn

- No visual polish on the notifications settings screen yet — a simple toggle list first, we can style later.
- No batching/BigQuery-style analytics.
- No SMS / email fallback.

---

**Confirm this and I'll start with step 1 (DB migration + secrets request), then step 2 (web One Tap + FCM), then edge functions, then hand you a Capacitor checklist.** Or tell me which parts to drop / reorder.
