/** Canonical match status values stored in `matches.status` after sync. */
export type DbMatchStatus = "scheduled" | "live" | "paused" | "finished";

export function normalizeDbMatchStatus(raw: string | null | undefined): DbMatchStatus {
  const s = (raw ?? "").toUpperCase();
  if (s === "IN_PLAY" || s === "LIVE") return "live";
  if (s === "PAUSED" || s === "HT" || s === "HALFTIME") return "paused";
  if (s === "FINISHED" || s === "FT" || s === "AET" || s === "PEN" || s === "AWARDED") return "finished";
  if (s === "live") return "live";
  if (s === "paused") return "paused";
  if (s === "finished") return "finished";
  return "scheduled";
}

export const LIVE_DB_STATUSES = ["live", "paused"] as const;
export const FINISHED_DB_STATUSES = ["finished"] as const;
