/**
 * Live Matches Function
 * Purpose: Aggregates live and recent football matches, primarily focusing on World Cup 2026.
 * HTTP Method: GET
 * Inputs:
 *   - status: Optional filter for match status (e.g., LIVE, FINISHED).
 * Outputs: JSON object with matches and last updated timestamp.
 * External APIs:
 *   - Football-Data.org: Primary match source.
 *   - TheSportsDB: Fallback for World Cup 2026 fixtures.
 *   - Firecrawl/Google: Real-time score and minute scraping.
 *   - Gemini 2.5 Flash Lite: AI-driven live status enrichment.
 */

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const FD = "https://api.football-data.org/v4";
let cache: { at: number; body: unknown } | null = null;

// Cache-Control tuned for 50k concurrent viewers: 10s browser cache, 15s
// shared CDN cache with stale-while-revalidate so a burst hitting a cold
// isolate is served from Cloudflare instead of stampeding football-data.org.
const CDN_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=10, s-maxage=15, stale-while-revalidate=30",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const token = Deno.env.get("FOOTBALL_DATA_API_TOKEN");
  if (!token) {
    return new Response(JSON.stringify({ error: "FOOTBALL_DATA_API_TOKEN missing" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // 15s in-memory cache on the warm isolate (matches CDN s-maxage).
  if (cache && Date.now() - cache.at < 15_000) {
    return new Response(JSON.stringify(cache.body), {
      headers: { ...cors, "Content-Type": "application/json", ...CDN_CACHE_HEADERS },
    });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "LIVE,IN_PLAY,PAUSED,FINISHED,SCHEDULED,TIMED";
  const today = new Date().toISOString().slice(0, 10);
  const dateTo = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);

  const res = await fetch(
    `${FD}/matches?dateFrom=${today}&dateTo=${dateTo}&status=${encodeURIComponent(status)}`,
    { headers: { "X-Auth-Token": token } },
  );

  if (!res.ok) {
    const detail = await res.text();
    return new Response(JSON.stringify({ error: `football-data ${res.status}`, detail }), {
      status: res.status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const raw = (await res.json()) as { matches: Array<Record<string, unknown>> };
  let matches = (raw.matches ?? []).map((m: any) => ({
    id: m.id,
    competition: m.competition?.name,
    competition_code: m.competition?.code,
    stage: m.stage,
    status: m.status,
    minute: m.minute ?? null,
    injury_time: m.injuryTime ?? null,
    utc_date: m.utcDate,
    home: { name: m.homeTeam?.name, tla: m.homeTeam?.tla, crest: m.homeTeam?.crest },
    away: { name: m.awayTeam?.name, tla: m.awayTeam?.tla, crest: m.awayTeam?.crest },
    score: {
      full: m.score?.fullTime ?? { home: null, away: null },
      half: m.score?.halfTime ?? { home: null, away: null },
    },
  }));

  // STRICT: only FIFA World Cup 2026 matches.
  matches = matches.filter((m: any) => /world cup/i.test(m.competition ?? ""));

  // Fallback: TheSportsDB free API for FIFA World Cup 2026 (league id 4429).
  if (matches.length === 0) {
    try {
      const endpoints = [
        "https://www.thesportsdb.com/api/v1/json/3/eventsseason.php?id=4429&s=2026",
        "https://www.thesportsdb.com/api/v1/json/3/eventspastleague.php?id=4429",
        "https://www.thesportsdb.com/api/v1/json/3/eventsnextleague.php?id=4429",
      ];
      const seen = new Set<string>();
      const merged: any[] = [];
      for (const u of endpoints) {
        const r = await fetch(u);
        if (!r.ok) continue;
        const j: any = await r.json();
        for (const e of j?.events ?? []) {
          if (!e?.idEvent || seen.has(e.idEvent)) continue;
          seen.add(e.idEvent);
          merged.push(e);
        }
      }
      const parseNum = (v: any) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      };
      /** Map TSDB status string to our internal status format */
      const statusFromTsdb = (s: string | null, progress: string | null): string => {
        const st = (s ?? "").toUpperCase();
        if (st === "FT" || st === "AET" || st === "PEN" || st === "MATCH FINISHED")
          return "FINISHED";
        if (st === "HT") return "PAUSED";
        if (progress && /\d/.test(progress)) return "IN_PLAY";
        if (st === "NS" || st === "" || st === "NOT STARTED") return "SCHEDULED";
        return "SCHEDULED";
      };
      matches = merged
        .map((e: any) => {
          const iso = e.strTimestamp
            ? new Date(e.strTimestamp + "Z").toISOString()
            : e.dateEvent
              ? new Date(`${e.dateEvent}T${e.strTime ?? "00:00:00"}Z`).toISOString()
              : null;
          return {
            id: Number(e.idEvent),
            competition: "FIFA World Cup",
            competition_code: "WC",
            stage: e.strSeason ? `WC ${e.strSeason}` : null,
            status: statusFromTsdb(e.strStatus, e.strProgress),
            minute: e.strProgress && /\d/.test(e.strProgress) ? parseInt(e.strProgress, 10) : null,
            injury_time: null,
            utc_date: iso,
            home: {
              name: e.strHomeTeam,
              tla: (e.strHomeTeam ?? "").slice(0, 3).toUpperCase(),
              crest: e.strHomeTeamBadge,
            },
            away: {
              name: e.strAwayTeam,
              tla: (e.strAwayTeam ?? "").slice(0, 3).toUpperCase(),
              crest: e.strAwayTeamBadge,
            },
            score: {
              full: { home: parseNum(e.intHomeScore), away: parseNum(e.intAwayScore) },
              half: { home: null, away: null },
            },
            live_source: "thesportsdb-wc2026",
          };
        })
        .filter((m: any) => m.utc_date)
        .sort((a: any, b: any) => a.utc_date.localeCompare(b.utc_date));
    } catch (e) {
      console.error("tsdb WC fallback failed", (e as Error).message);
    }
  }

  // Google scrape enrichment via Firecrawl — reliable minute + score.
  const fcKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (fcKey) {
    const liveIdx = matches
      .map((m: any, i: number) => ({ m, i }))
      .filter(({ m }) => ["IN_PLAY", "LIVE", "PAUSED", "SCHEDULED", "TIMED"].includes(m.status));

    await Promise.all(
      liveIdx.map(async ({ m, i }) => {
        try {
          const query = `${m.home.name} vs ${m.away.name} live score`;
          const fcRes = await fetch("https://api.firecrawl.dev/v2/search", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${fcKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ query, limit: 3, sources: ["web"] }),
          });
          if (!fcRes.ok) return;
          const fcJson: any = await fcRes.json();
          const results: any[] = fcJson?.data?.web ?? fcJson?.data ?? [];
          const text = results
            .map((r: any) => `${r.title ?? ""} ${r.description ?? r.snippet ?? ""}`)
            .join(" ")
            .replace(/\s+/g, " ");
          if (!text) return;

          let minute: number | null = null;
          let injury: number | null = null;
          let status = m.status;
          const htMatch = /\b(HT|Half[- ]time)\b/i.test(text);
          const ftMatch = /\b(FT|Full[- ]time|Full Time|Ended)\b/i.test(text);
          const minMatch = text.match(/(\d{1,3})(?:\s*\+\s*(\d{1,2}))?\s*['’]/);
          if (ftMatch) {
            status = "FINISHED";
          } else if (htMatch) {
            status = "PAUSED";
          } else if (minMatch) {
            const mn = parseInt(minMatch[1], 10);
            if (mn > 0 && mn <= 130) {
              minute = mn;
              if (minMatch[2]) injury = parseInt(minMatch[2], 10);
              status = "IN_PLAY";
            }
          }
          const scoreMatch = text.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})/);
          let sHome = m.score.full.home;
          let sAway = m.score.full.away;
          if (scoreMatch) {
            sHome = parseInt(scoreMatch[1], 10);
            sAway = parseInt(scoreMatch[2], 10);
          }
          matches[i] = {
            ...m,
            status,
            minute: minute ?? m.minute,
            injury_time: injury ?? m.injury_time,
            score: { ...m.score, full: { home: sHome, away: sAway } },
            minute_source: minute ? "google-firecrawl" : m.minute_source,
            sources: [...(m.sources ?? []), "google-firecrawl"],
          };
        } catch (e) {
          console.error("firecrawl scrape failed", (e as Error).message);
        }
      }),
    );
  }

  // Native Google Gemini 2.5 Flash Lite fallback.
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (geminiKey) {
    const need = matches
      .map((m: any, i: number) => ({ m, i }))
      .filter(
        ({ m }) => ["IN_PLAY", "LIVE"].includes(m.status) && (m.minute == null || m.minute === 0),
      );
    await Promise.all(
      need.map(async ({ m, i }) => {
        try {
          const prompt = `Live football score check. FIFA World Cup 2026 match "${m.home.name} vs ${m.away.name}", kickoff ${m.utc_date}. Return current live state as compact JSON only: {"minute":number|null,"injury":number|null,"home":number|null,"away":number|null,"status":"IN_PLAY"|"PAUSED"|"FINISHED"|"SCHEDULED"}. No prose.`;
          const r = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json", temperature: 0 },
              }),
            },
          );
          if (!r.ok) return;
          const j: any = await r.json();
          const raw: string =
            j?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
          const jsonMatch = raw.match(/\{[\s\S]*\}/);
          if (!jsonMatch) return;
          const p = JSON.parse(jsonMatch[0]);
          matches[i] = {
            ...m,
            status: typeof p.status === "string" ? p.status : m.status,
            minute: typeof p.minute === "number" ? p.minute : m.minute,
            injury_time: typeof p.injury === "number" ? p.injury : m.injury_time,
            score: {
              ...m.score,
              full: {
                home: typeof p.home === "number" ? p.home : m.score.full.home,
                away: typeof p.away === "number" ? p.away : m.score.full.away,
              },
            },
            minute_source: "gemini-2.5-flash-lite",
            sources: [...(m.sources ?? []), "gemini-2.5-flash-lite"],
          };
        } catch (e) {
          console.error("gemini live-matches failed", (e as Error).message);
        }
      }),
    );
  }

  // Final fallback: if still no minute, compute from kickoff time.
  matches = matches.map((m: any) => {
    if (!["IN_PLAY", "LIVE"].includes(m.status)) return m;
    if (m.minute != null && m.minute > 0) return m;
    const koMs = new Date(m.utc_date).getTime();
    if (!Number.isFinite(koMs)) return m;
    const elapsedMin = Math.floor((Date.now() - koMs) / 60000);
    if (elapsedMin <= 0) return m;
    let minute = elapsedMin;
    if (minute > 45 && minute <= 60) minute = 45;
    else if (minute > 60) minute = Math.min(minute - 15, 120);
    return { ...m, minute, minute_source: "kickoff-fallback" };
  });

  // Sort: live first, then scheduled today, then finished
  const rank = (s: string) =>
    ["IN_PLAY", "PAUSED", "LIVE"].includes(s) ? 0 : s === "SCHEDULED" || s === "TIMED" ? 1 : 2;
  matches.sort(
    (a: any, b: any) => rank(a.status) - rank(b.status) || a.utc_date.localeCompare(b.utc_date),
  );

  const body = { matches, updated_at: new Date().toISOString() };
  cache = { at: Date.now(), body };

  return new Response(JSON.stringify(body), {
    headers: { ...cors, "Content-Type": "application/json", ...CDN_CACHE_HEADERS },
  });
});
