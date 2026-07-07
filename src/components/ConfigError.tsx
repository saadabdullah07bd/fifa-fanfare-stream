export default function ConfigError() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <div className="max-w-lg rounded-xl border border-border bg-card p-8 text-center shadow-lg">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-primary text-2xl font-black text-primary-foreground">
          26
        </div>
        <h1 className="text-2xl font-bold">Pitch26 configuration missing</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Set these environment variables in cPanel, then run <code className="rounded bg-muted px-1">npm run build</code> and restart the app:
        </p>
        <ul className="mt-4 space-y-1 text-left text-sm font-mono">
          <li>VITE_SUPABASE_URL</li>
          <li>VITE_SUPABASE_PUBLISHABLE_KEY</li>
          <li>VITE_SITE_URL=https://pitch26.drmabari.com</li>
        </ul>
      </div>
    </div>
  );
}
