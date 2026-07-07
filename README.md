# Pitch26 deployment

This project is a Vite React SPA and can be hosted on Hostinger as a Node.js app.

## Run locally (production mode)

1. Install dependencies:
   - `npm install`
2. Build:
   - `npm run build`
3. Start server:
   - `npm start`
4. Open:
   - `http://localhost:3000`

## Hostinger Node.js setup

Use these values in Hostinger's Node app configuration:

- Build command: `npm run hostinger:build`
- Start command: `npm run hostinger:start`
- Application startup file: `server.mjs`
- Node version: `18+` (recommended `20+`)

The app reads `PORT` from environment automatically.

## cPanel Node.js setup

Use these values in cPanel **Setup Node.js App**:

- Application root: your project folder (where `package.json` is)
- Application startup file: `server.mjs`
- Application mode: Production
- Build command: `npm run cpanel:build`
- Start/restart after build: `npm run cpanel:start`

Important:

1. Set env vars in cPanel **before** running build.
2. Run build every time env vars change (`VITE_*` are baked at build time).
3. Do not point the domain to source files only — the app must serve the built `dist/` folder via `server.mjs`.

If env vars are missing, the app now shows a configuration screen instead of a blank white page.

## Required environment variables

Set these in Hostinger environment settings:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SITE_URL` (your public domain, e.g. `https://yourdomain.com`)

## Notes

- `server.mjs` serves `dist/` and includes SPA fallback to `index.html`, so routes like `/fixtures` and `/match/123` work directly.
- Supabase Edge Functions remain hosted on Supabase; Hostinger serves only the frontend bundle.
