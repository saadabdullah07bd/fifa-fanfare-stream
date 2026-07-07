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
- Node version: `18+` (recommended `20+`)

The app reads `PORT` from environment automatically.

## Required environment variables

Set these in Hostinger environment settings:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SITE_URL` (your public domain, e.g. `https://yourdomain.com`)

## Notes

- `server.mjs` serves `dist/` and includes SPA fallback to `index.html`, so routes like `/fixtures` and `/match/123` work directly.
- Supabase Edge Functions remain hosted on Supabase; Hostinger serves only the frontend bundle.
