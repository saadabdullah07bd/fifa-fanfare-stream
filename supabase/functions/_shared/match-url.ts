import wc26 from "./wc26-matches.json" assert { type: "json" };

type Wc26Row = {
  match_no: number;
  home_code: string | null;
  away_code: string | null;
  home_name: string;
  away_name: string;
  date_utc: string | null;
};

const rows = wc26 as Wc26Row[];

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Resolve a WC26 workbook match number from DB team codes and kickoff time. */
export function wc26MatchNo(
  homeCode: string | null | undefined,
  awayCode: string | null | undefined,
  dateUtc: string | null | undefined,
): number | null {
  const h = (homeCode ?? "").toUpperCase();
  const a = (awayCode ?? "").toUpperCase();
  if (!h || !a) return null;
  const day = dateUtc?.slice(0, 10) ?? null;
  const candidates = rows.filter(
    (m) =>
      (m.home_code?.toUpperCase() === h && m.away_code?.toUpperCase() === a) ||
      (m.home_code?.toUpperCase() === a && m.away_code?.toUpperCase() === h),
  );
  if (!candidates.length) return null;
  if (day) {
    const same = candidates.find((m) => (m.date_utc ?? "").slice(0, 10) === day);
    if (same) return same.match_no;
  }
  return candidates[0]?.match_no ?? null;
}

export function matchPageUrl(m: {
  home_team_code?: string | null;
  away_team_code?: string | null;
  date_utc?: string | null;
}): string {
  const no = wc26MatchNo(m.home_team_code, m.away_team_code, m.date_utc);
  return no != null ? `/match/${no}` : "/fixtures";
}
