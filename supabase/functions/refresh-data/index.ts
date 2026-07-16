/**
 * Data Refresh Function
 * Purpose: Synchronizes football data (teams, matches, standings, scorers, news) from external APIs to the Supabase database.
 * HTTP Method: POST (Authorized via CRON_SECRET or Supabase Anon Key)
 * Inputs:
 *   - mode: "full" (all data) | "matches" (only match updates).
 * Outputs: JSON summary of sync results for each data type.
 * External APIs:
 *   - Football-Data.org: Tournament structure and results.
 *   - NewsAPI: Tournament news articles.
 * Auth: Verified against environment CRON_SECRET or bearer tokens.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeDbMatchStatus } from "../_shared/match-status.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// FIFA World Cup competition code on football-data.org
const FD_COMPETITION = "WC";
const FD_BASE = "https://api.football-data.org/v4";

Deno.serve(async (req) => {
  // CORS Preflight
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  // Authorization: only the scheduled-job secret can trigger a refresh.
  // Previously any request bearing the public anon key was accepted, which
  // meant anyone on the internet could force a full sync (blowing external-
  // API quotas and DB churn). CRON_SECRET is server-only.
  const expected = Deno.env.get("CRON_SECRET");
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const cronHeader = req.headers.get("x-cron-secret") ?? "";

  const authorized = !!expected && (cronHeader === expected || bearer === expected);

  if (!authorized) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Admin client with service role for DB writes
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    {
      auth: { persistSession: false },
    },
  );
  const results: Record<string, string> = {};
  const now = new Date().toISOString();

  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") ?? "full";

  /** Logs the result of a specific sync operation to the database */
  async function record(source: string, status: string, detail?: string) {
    await admin
      .from("scrape_runs")
      .upsert({ source, status, detail: detail ?? null, last_run_at: now });
    results[source] = status + (detail ? `: ${detail}` : "");
  }

  const fdToken = Deno.env.get("FOOTBALL_DATA_API_TOKEN");
  const newsKey = Deno.env.get("NEWSAPI_KEY");

  // ---- football-data.org: teams, matches, standings, scorers ----
  if (fdToken) {
    const fdHeaders = { "X-Auth-Token": fdToken };

    // Teams (skip in matches-only mode)
    if (mode !== "matches")
      try {
        const res = await fetch(`${FD_BASE}/competitions/${FD_COMPETITION}/teams`, {
          headers: fdHeaders,
        });
        if (res.ok) {
          const { teams } = (await res.json()) as {
            teams: Array<{ tla: string; name: string; crest: string; area: { name: string } }>;
          };
          const teamRows = teams
            .filter((t) => !!t.tla)
            .map((t) => ({
              code: t.tla,
              name: t.name,
              flag_url: t.crest,
              confederation: t.area?.name ?? null,
            }));
          if (teamRows.length) {
            await admin.from("teams").upsert(teamRows, { onConflict: "code" });
          }
          await record("teams", "ok", `${teams.length} teams`);
        } else await record("teams", "error", `HTTP ${res.status}`);
      } catch (e) {
        await record("teams", "error", (e as Error).message.slice(0, 200));
      }

    // Matches
    try {
      const res = await fetch(`${FD_BASE}/competitions/${FD_COMPETITION}/matches`, {
        headers: fdHeaders,
      });
      if (res.ok) {
        const { matches } = (await res.json()) as { matches: Array<any> };
        const matchRows = matches.map((m) => {
          const status = normalizeDbMatchStatus(m.status);
          return {
            external_id: `fd_${m.id}`,
            stage: (m.stage || "GROUP_STAGE").toLowerCase().replace(/_/g, "-"),
            group: m.group ? String(m.group).replace(/^GROUP_/, "") : null,
            date_utc: m.utcDate,
            home_team_code: m.homeTeam?.tla ?? null,
            away_team_code: m.awayTeam?.tla ?? null,
            home_score: m.score?.fullTime?.home ?? null,
            away_score: m.score?.fullTime?.away ?? null,
            status,
            minute: m.minute ?? null,
            updated_at: now,
          };
        });
        if (matchRows.length) {
          await admin.from("matches").upsert(matchRows, { onConflict: "external_id" });
        }
        await record("matches", "ok", `${matches.length} matches`);
      } else await record("matches", "error", `HTTP ${res.status}`);
    } catch (e) {
      await record("matches", "error", (e as Error).message.slice(0, 200));
    }

    // Standings (skip in matches-only mode)
    if (mode !== "matches")
      try {
        const res = await fetch(`${FD_BASE}/competitions/${FD_COMPETITION}/standings`, {
          headers: fdHeaders,
        });
        if (res.ok) {
          const { standings } = (await res.json()) as {
            standings: Array<{ group?: string; type: string; table: Array<any> }>;
          };
          const standingRows: Array<Record<string, unknown>> = [];
          for (const s of standings) {
            if (s.type !== "TOTAL") continue;
            const groupLetter = s.group ? String(s.group).replace(/^GROUP_/, "") : null;
            if (!groupLetter) continue;
            for (const row of s.table) {
              standingRows.push({
                group: groupLetter,
                team_code: row.team.tla,
                played: row.playedGames,
                w: row.won,
                d: row.draw,
                l: row.lost,
                gf: row.goalsFor,
                ga: row.goalsAgainst,
                gd: row.goalDifference,
                pts: row.points,
                updated_at: now,
              });
            }
          }
          if (standingRows.length) {
            await admin.from("standings").upsert(standingRows, { onConflict: "group,team_code" });
          }
          const count = standingRows.length;
          await record("standings", "ok", `${count} rows`);
        } else await record("standings", "error", `HTTP ${res.status}`);
      } catch (e) {
        await record("standings", "error", (e as Error).message.slice(0, 200));
      }

    // Scorers (skip in matches-only mode)
    if (mode !== "matches")
      try {
        const res = await fetch(`${FD_BASE}/competitions/${FD_COMPETITION}/scorers?limit=50`, {
          headers: fdHeaders,
        });
        if (res.ok) {
          const { scorers } = (await res.json()) as { scorers: Array<any> };
          // Clear previous scorers and insert new list
          await admin.from("scorers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
          const scorerRows = scorers.map((s) => ({
            player: s.player.name,
            team_code: s.team.tla,
            goals: s.goals ?? 0,
            assists: s.assists ?? 0,
          }));
          if (scorerRows.length) await admin.from("scorers").insert(scorerRows);
          await record("scorers", "ok", `${scorers.length} scorers`);
        } else await record("scorers", "error", `HTTP ${res.status}`);
      } catch (e) {
        await record("scorers", "error", (e as Error).message.slice(0, 200));
      }
  } else {
    await record("football-data", "skipped", "FOOTBALL_DATA_API_TOKEN not set");
  }

  // ---- NewsAPI (skip in matches-only mode) ----
  if (mode !== "matches") {
    if (newsKey) {
      try {
        const newsUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent("FIFA World Cup 2026")}&sortBy=publishedAt&language=en&pageSize=30&apiKey=${newsKey}`;
        const res = await fetch(newsUrl);
        if (res.ok) {
          const { articles } = (await res.json()) as { articles: Array<any> };
          const newsRows = articles
            .filter((a) => !!a.url && !!a.title)
            .map((a) => ({
              url: a.url,
              title: a.title,
              summary: a.description ?? null,
              source: a.source?.name ?? new URL(a.url).hostname.replace(/^www\./, ""),
              image_url: a.urlToImage ?? null,
              published_at: a.publishedAt ?? now,
            }));
          if (newsRows.length) await admin.from("news").upsert(newsRows, { onConflict: "url" });
          await record("news", "ok", `${articles.length} items`);
        } else await record("news", "error", `HTTP ${res.status}`);
      } catch (e) {
        await record("news", "error", (e as Error).message.slice(0, 200));
      }
    } else {
      await record("news", "skipped", "NEWSAPI_KEY not set");
    }
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
