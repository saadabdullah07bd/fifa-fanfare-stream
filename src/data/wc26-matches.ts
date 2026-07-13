import raw from "./wc26-matches.json";

export type Wc26Goal = {
  player: string;
  minute: number;
  injury: number | null;
  type: "REGULAR" | "OG" | "PEN" | string;
  team?: string;
};

export type Wc26Card = {
  player: string;
  team: string;
  minute: number;
  injury: number | null;
};

export type Wc26Match = {
  match_no: number;
  stage:
    | "GROUP"
    | "LAST_32"
    | "LAST_16"
    | "QUARTER_FINALS"
    | "SEMI_FINALS"
    | "THIRD_PLACE"
    | "FINAL"
    | string;
  stage_label: string;
  date_utc: string | null;
  home_name: string;
  away_name: string;
  home_code: string | null;
  away_code: string | null;
  home_score: number | null;
  away_score: number | null;
  venue_name: string | null;
  venue_city: string | null;
  venue_country: string | null;
  penalty_shootout: string | null;
  extra_time: boolean;
  goals: Wc26Goal[];
  yellow_cards: Wc26Card[];
  red_cards: Wc26Card[];
  referee: string | null;
  attendance: number | null;
  notes: string | null;
};

// Static authoritative dataset — sourced from the FIFA World Cup 2026 workbook the
// user provided. Fixtures/MatchDetail read from this file so venue, kickoff and
// scorer data never depend on live API or AI enrichment.
export const WC26_MATCHES = raw as Wc26Match[];

export function getWc26Match(id: string | number | undefined): Wc26Match | undefined {
  if (id == null) return undefined;
  const n = typeof id === "string" ? parseInt(id, 10) : id;
  if (!Number.isFinite(n)) return undefined;
  return WC26_MATCHES.find((m) => m.match_no === n);
}

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Find a wc26 match by team names (order-insensitive) and optional ISO date. */
export function findWc26MatchByTeams(
  home: string | null | undefined,
  away: string | null | undefined,
  utcDate?: string | null,
): Wc26Match | undefined {
  const a = norm(home);
  const b = norm(away);
  if (!a || !b) return undefined;
  const day = utcDate ? utcDate.slice(0, 10) : null;
  const candidates = WC26_MATCHES.filter((m) => {
    const h = norm(m.home_name),
      aw = norm(m.away_name);
    return (h === a && aw === b) || (h === b && aw === a);
  });
  if (candidates.length === 0) return undefined;
  if (day) {
    const same = candidates.find((m) => (m.date_utc ?? "").slice(0, 10) === day);
    if (same) return same;
  }
  return candidates[0];
}
