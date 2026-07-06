// Live match statistics via SofaScore's public JSON API. No key required.
// We search by team names + date, then pull /statistics for that event.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const UA = "Mozilla/5.0 (compatible; Pitch26/1.0)";
const cache = new Map<string, { at: number; body: unknown }>();

async function sofaSearch(q: string): Promise<any[]> {
  const r = await fetch(
    `https://api.sofascore.com/api/v1/search/events/${encodeURIComponent(q)}`,
    { headers: { "User-Agent": UA, Accept: "application/json" } },
  );
  if (!r.ok) return [];
  const j = await r.json().catch(() => ({}));
  return j?.results?.map((x: any) => x.entity).filter(Boolean) ?? [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const url = new URL(req.url);
  const home = url.searchParams.get("home") ?? "";
  const away = url.searchParams.get("away") ?? "";
  const date = url.searchParams.get("date") ?? ""; // ISO date optional
  if (!home || !away) {
    return new Response(JSON.stringify({ error: "home and away required" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const key = `${home}|${away}|${date}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 45_000) {
    return new Response(JSON.stringify(hit.body), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    // Try increasingly loose queries
    let results: any[] = [];
    for (const q of [`${home} ${away}`, home, away]) {
      results = await sofaSearch(q);
      if (results.length) break;
    }

    // Match event where both team names appear
    const target = new Date(date || Date.now()).getTime();
    const hl = home.toLowerCase();
    const al = away.toLowerCase();
    const event = results
      .filter((e) => {
        const h = (e.homeTeam?.name ?? "").toLowerCase();
        const a = (e.awayTeam?.name ?? "").toLowerCase();
        return (h.includes(hl.split(" ")[0]) || hl.includes(h.split(" ")[0])) &&
               (a.includes(al.split(" ")[0]) || al.includes(a.split(" ")[0]));
      })
      .sort((a, b) => Math.abs((a.startTimestamp ?? 0) * 1000 - target) - Math.abs((b.startTimestamp ?? 0) * 1000 - target))[0];

    if (!event) {
      const body = { available: false, reason: "no matching event", stats: [], status: null };
      cache.set(key, { at: Date.now(), body });
      return new Response(JSON.stringify(body), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const [statsRes, eventRes] = await Promise.all([
      fetch(`https://api.sofascore.com/api/v1/event/${event.id}/statistics`, { headers: { "User-Agent": UA } }),
      fetch(`https://api.sofascore.com/api/v1/event/${event.id}`, { headers: { "User-Agent": UA } }),
    ]);
    const statsJson = statsRes.ok ? await statsRes.json() : null;
    const eventJson = eventRes.ok ? await eventRes.json() : null;

    const period = statsJson?.statistics?.find((p: any) => p.period === "ALL") ?? statsJson?.statistics?.[0];
    const groups = period?.groups?.flatMap((g: any) => g.statisticsItems ?? []) ?? [];
    const stats = groups.map((s: any) => ({
      name: s.name,
      home: s.home,
      away: s.away,
      compareCode: s.compareCode ?? null,
    }));

    const ev = eventJson?.event;
    const body = {
      available: stats.length > 0,
      source: "sofascore",
      event_id: event.id,
      slug: event.slug,
      status: ev?.status?.description ?? null,
      status_type: ev?.status?.type ?? null,
      minute: ev?.time?.currentPeriodStartTimestamp ? null : null,
      home_score: ev?.homeScore?.current ?? null,
      away_score: ev?.awayScore?.current ?? null,
      stats,
    };
    cache.set(key, { at: Date.now(), body });
    return new Response(JSON.stringify(body), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ available: false, error: String(e), stats: [] }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
