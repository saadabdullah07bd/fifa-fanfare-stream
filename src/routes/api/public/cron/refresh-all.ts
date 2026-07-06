import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cron/refresh-all")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Any pg_cron call via net.http_post arrives here. We don't require a
        // secret because /api/public/* already skips edge auth; we just kick
        // off the refresh and return quickly.
        void request;
        try {
          const { refreshAll } = await import("@/lib/refresh.functions");
          const result = await refreshAll();
          return Response.json({ ok: true, result });
        } catch (e) {
          return Response.json(
            { ok: false, error: (e as Error).message },
            { status: 500 },
          );
        }
      },
    },
  },
});
