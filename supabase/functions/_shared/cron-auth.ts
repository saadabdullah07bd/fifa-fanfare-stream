/** Fail closed: cron-triggered functions must reject when the secret is missing or wrong. */
export function assertCronSecret(req: Request): Response | null {
  const expected = Deno.env.get("CRON_SECRET");
  if (!expected) {
    return new Response(JSON.stringify({ error: "CRON_SECRET not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
  const provided =
    req.headers.get("x-cron-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  if (provided !== expected) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}
