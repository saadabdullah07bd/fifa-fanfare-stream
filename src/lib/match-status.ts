export type AppMatchStatus = "scheduled" | "live" | "finished";

export function normalizeAppMatchStatus(status: string | null | undefined): AppMatchStatus {
  const s = (status ?? "").toUpperCase();
  if (s === "LIVE" || s === "IN_PLAY" || s === "PAUSED") return "live";
  if (s === "FINISHED" || s === "FT") return "finished";
  if (s === "SCHEDULED" || s === "TIMED") return "scheduled";
  if (s === "finished" || s === "ft") return "finished";
  if (s === "live") return "live";
  return "scheduled";
}
