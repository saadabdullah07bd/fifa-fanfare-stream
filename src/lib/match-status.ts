/** Possible match statuses used within the application */
export type AppMatchStatus = "scheduled" | "live" | "finished";

/**
 * Normalizes various API match status strings into a unified AppMatchStatus.
 * @param status - The raw status string from the API.
 * @returns The normalized AppMatchStatus.
 */
export function normalizeAppMatchStatus(status: string | null | undefined): AppMatchStatus {
  const s = (status ?? "").toUpperCase();
  if (s === "LIVE" || s === "IN_PLAY" || s === "PAUSED") return "live";
  if (s === "FINISHED" || s === "FT") return "finished";
  if (s === "SCHEDULED" || s === "TIMED") return "scheduled";
  if (s === "finished" || s === "ft") return "finished";
  if (s === "live") return "live";
  return "scheduled";
}
