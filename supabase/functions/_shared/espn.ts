/**
 * ESPN scoreboard mapping helpers.
 *
 * Source is ESPN's public `soccer/fifa.world` scoreboard JSON — a structured
 * feed, already scoped to the World Cup, keyless, carrying a real match clock
 * and goal/card events in `competitions[0].details`.
 *
 * These functions are pure so they can be unit-tested off a captured payload.
 * The network call lives in the live-matches function.
 */

export const ESPN_SCOREBOARD =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";

/** YYYYMMDD in UTC, offset by `dayDelta` days from `now`. */
export const espnDay = (dayDelta: number, now: number = Date.now()) =>
  new Date(now + dayDelta * 86400_000).toISOString().slice(0, 10).replace(/-/g, "");

/**
 * Map an ESPN status object to our internal status.
 * `status.type.state` is "pre" | "in" | "post"; `status.type.name` carries the
 * finer-grained phase (STATUS_HALFTIME, STATUS_FULL_TIME, ...).
 */
export function statusFromEspn(type: any): string {
  const name = String(type?.name ?? "").toUpperCase();
  const state = String(type?.state ?? "").toLowerCase();
  if (name.includes("HALFTIME")) return "PAUSED";
  if (state === "pre") return "SCHEDULED";
  if (state === "in") return "IN_PLAY";
  if (state === "post") return "FINISHED";
  return "SCHEDULED";
}

/**
 * Current minute. `displayClock` ("45'", "90'+7'") is authoritative when
 * present; `status.clock` is elapsed SECONDS, so it needs /60.
 */
export function minuteFromEspn(status: any): number | null {
  const m = String(status?.displayClock ?? "").match(/(\d+)/);
  if (m) return parseInt(m[1], 10);
  const clock = Number(status?.clock);
  if (Number.isFinite(clock) && clock > 0) return Math.floor(clock / 60);
  return null;
}

/** Goal/card events for a match, straight from ESPN's `details` array. */
export function eventsFromEspn(details: any[]): any[] {
  return (details ?? [])
    .map((d: any) => {
      const m = String(d?.clock?.displayValue ?? "").match(/(\d+)/);
      return {
        minute: m ? parseInt(m[1], 10) : null,
        player: d?.athletesInvolved?.[0]?.displayName ?? null,
        team_id: d?.team?.id ?? null,
        type: String(d?.type?.text ?? ""),
        scoring: Boolean(d?.scoringPlay),
        penalty: Boolean(d?.penaltyKick),
        own_goal: Boolean(d?.ownGoal),
        red_card: Boolean(d?.redCard),
        yellow_card: Boolean(d?.yellowCard),
      };
    })
    .filter((e: any) => e.minute != null);
}

/** Map a raw ESPN scoreboard payload to our internal match shape. */
export function mapEspnScoreboard(payload: any): any[] {
  return (payload?.events ?? [])
    .map((e: any) => {
      const comp = e?.competitions?.[0];
      if (!comp) return null;
      const cs = comp.competitors ?? [];
      const home = cs.find((c: any) => c.homeAway === "home");
      const away = cs.find((c: any) => c.homeAway === "away");
      if (!home || !away) return null;

      const status = statusFromEspn(e?.status?.type);
      const live = status === "IN_PLAY" || status === "PAUSED";
      // ESPN reports "0" for a not-yet-started match; that is absence of a
      // score, not a 0-0 draw. Only trust the number once it's under way.
      const scoreOf = (c: any) => {
        if (status === "SCHEDULED") return null;
        const n = Number(c?.score);
        return Number.isFinite(n) ? n : null;
      };
      const side = (c: any) => ({
        name: c?.team?.displayName ?? null,
        tla: c?.team?.abbreviation ?? null,
        crest: c?.team?.logo ?? null,
      });

      return {
        id: Number(e.id),
        competition: "FIFA World Cup",
        competition_code: "WC",
        stage: comp?.notes?.[0]?.headline ?? null,
        status,
        minute: live ? minuteFromEspn(e?.status) : null,
        injury_time: null,
        utc_date: e?.date ? new Date(e.date).toISOString() : null,
        home: side(home),
        away: side(away),
        score: {
          full: { home: scoreOf(home), away: scoreOf(away) },
          half: { home: null, away: null },
        },
        venue: comp?.venue?.fullName ?? null,
        events: eventsFromEspn(comp?.details),
        live_source: "espn-fifa-world",
      };
    })
    .filter((m: any) => m && m.utc_date);
}

/** Sort: live first, then scheduled, then finished; each by kickoff time. */
export function sortMatches(matches: any[]): any[] {
  const rank = (s: string) =>
    ["IN_PLAY", "PAUSED", "LIVE"].includes(s) ? 0 : s === "SCHEDULED" || s === "TIMED" ? 1 : 2;
  return [...matches].sort(
    (a, b) =>
      rank(a.status) - rank(b.status) || String(a.utc_date).localeCompare(String(b.utc_date)),
  );
}
