import { useEffect, useState } from "react";

/**
 * A live match minute that ticks between polls.
 *
 * The provider's minute is the source of truth, but `live-matches` is only
 * polled every 30s, so a bare render would show the clock jumping 30s at a
 * time and sitting frozen in between. This anchors on the last real minute
 * received and advances it with local wall-clock time, re-anchoring on every
 * poll — so the number is never more than one poll out of step with the feed.
 *
 * It does NOT invent a clock: with no provider minute it returns null, and it
 * holds still at half time (PAUSED), when the real clock is also stopped.
 */
export function useLiveMinute(minute: number | null, status: string): number | null {
  const ticking = status === "IN_PLAY" || status === "LIVE";
  // Re-anchor whenever the feed gives us a new minute.
  const [anchor, setAnchor] = useState(() => ({ minute, at: Date.now() }));
  const [, setTick] = useState(0);

  useEffect(() => {
    setAnchor({ minute, at: Date.now() });
  }, [minute, status]);

  useEffect(() => {
    if (!ticking || anchor.minute == null) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [ticking, anchor.minute, anchor.at]);

  if (anchor.minute == null) return minute;
  if (!ticking) return anchor.minute;

  const elapsed = Math.floor((Date.now() - anchor.at) / 60_000);
  // Cap at 120 so a stalled feed can't run the clock away; a real match that
  // goes beyond that is in stoppage time, which the feed reports separately.
  return Math.min(anchor.minute + Math.max(elapsed, 0), 120);
}
