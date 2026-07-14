import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { BarChart3, Users } from "lucide-react";
import { staggerParent, staggerChild, useReducedMotionSafe } from "@/lib/motion";
import PitchGraphic from "@/components/PitchGraphic";
import FormationPitch from "@/components/FormationPitch";
import type { Wc26Match } from "@/data/wc26-matches";

/** One player in a real API-Football lineup. */
type RealPlayer = {
  id: number | null;
  name: string;
  number: number | null;
  pos: string | null;
  grid: string | null;
  photo: string | null;
};

/** A real team lineup from the match-stats function. */
type RealLineup = {
  team_id: number | null;
  team: string;
  formation: string | null;
  coach: string | null;
  coach_photo: string | null;
  startXI: RealPlayer[];
  substitutes: RealPlayer[];
};

type MatchStatsResponse = {
  available: boolean;
  status_short: string | null;
  home_name?: string;
  away_name?: string;
  stats: { name: string; home: number | string | null; away: number | string | null }[];
  lineups: RealLineup[];
};

/** Stats worth showing, in broadcast order. */
const STAT_WHITELIST = [
  "Ball Possession",
  "Total Shots",
  "Shots on Goal",
  "Corner Kicks",
  "Fouls",
  "Offsides",
  "Yellow Cards",
  "Goalkeeper Saves",
];

function toNum(v: number | string | null): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  return parseFloat(String(v).replace("%", "")) || 0;
}

/** A single comparative stat row with proportional bars. */
function StatBar({
  name,
  home,
  away,
}: {
  name: string;
  home: number | string | null;
  away: number | string | null;
}) {
  const h = toNum(home);
  const a = toNum(away);
  const total = h + a || 1;
  return (
    <motion.li variants={staggerChild} className="space-y-1">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-sm">
        <span className="text-right font-semibold tabular-nums">{home ?? 0}</span>
        <span className="px-2 text-center text-[11px] uppercase tracking-wider text-muted-foreground">
          {name}
        </span>
        <span className="font-semibold tabular-nums">{away ?? 0}</span>
      </div>
      <div className="flex gap-1" aria-hidden="true">
        <div className="flex h-1.5 flex-1 justify-end overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${(h / total) * 100}%` }}
          />
        </div>
        <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-foreground/50"
            style={{ width: `${(a / total) * 100}%` }}
          />
        </div>
      </div>
    </motion.li>
  );
}

/** Compact per-team meta card: team name + formation + coach. */
function LineupMeta({ l, align }: { l: RealLineup; align: "left" | "right" }) {
  return (
    <div
      className={`min-w-0 rounded-2xl border border-border/60 bg-card/60 p-4 ${align === "right" ? "text-right" : ""}`}
    >
      <div
        className={`flex items-baseline justify-between gap-2 ${align === "right" ? "flex-row-reverse" : ""}`}
      >
        <h4 className="truncate font-bold">{l.team}</h4>
        {l.formation && (
          <span className="display shrink-0 text-lg text-primary">{l.formation}</span>
        )}
      </div>
      {l.coach && (
        <p className="mt-1 truncate text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Coach · {l.coach}
        </p>
      )}
    </div>
  );
}

/**
 * Broadcast-style combined lineup graphic: both starting XIs on one turf,
 * facing each other — the home side (gold jerseys) attacking up from the
 * bottom, the away side (white jerseys) attacking down from the top.
 */
function CombinedPitch({ home, away }: { home: RealLineup; away: RealLineup }) {
  return (
    <div className="relative mx-auto aspect-[2/3] w-full max-w-md overflow-hidden rounded-2xl border border-border/60 shadow-inner">
      <PitchGraphic />
      <div className="absolute inset-0 flex flex-col">
        <div className="flex-1">
          <FormationPitch startXI={away.startXI} isHome={false} flip />
        </div>
        <div className="flex-1">
          <FormationPitch startXI={home.startXI} isHome={true} />
        </div>
      </div>
    </div>
  );
}

const STATS_FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/match-stats`;

/** Fetch REAL stats + lineups for a match from API-Football (via match-stats). */
function useMatchStats(match: Wc26Match) {
  const home = match.home_name;
  const away = match.away_name;
  const date = match.date_utc ?? "";
  return useQuery({
    queryKey: ["match-stats", home, away, date],
    enabled: !!home && !!away,
    staleTime: 60_000,
    gcTime: 24 * 3600_000,
    queryFn: async () => {
      const url = `${STATS_FN}?home=${encodeURIComponent(home)}&away=${encodeURIComponent(
        away,
      )}&date=${encodeURIComponent(date)}`;
      const res = await fetch(url, {
        headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      });
      if (!res.ok) throw new Error(`match-stats failed (${res.status})`);
      return (await res.json()) as MatchStatsResponse;
    },
  });
}

/**
 * Match stats + lineups sourced from REAL match data via API-Football (the
 * `match-stats` edge function resolves each fixture and returns official
 * lineups, formation, coach and comparative stats). Nothing here is composed or
 * estimated: if the API has no lineup/stats for this match yet — because it is
 * a synthetic pairing with no real fixture, or a real fixture whose lineups
 * aren't published until ~1h before kickoff — the corresponding section is
 * simply hidden rather than showing a made-up XI.
 */
export default function MatchStatsPanel({ match }: { match: Wc26Match }) {
  const reduced = useReducedMotionSafe();
  const { data } = useMatchStats(match);

  const shown = (data?.stats ?? [])
    .filter((s) => STAT_WHITELIST.includes(s.name))
    .sort((a, b) => STAT_WHITELIST.indexOf(a.name) - STAT_WHITELIST.indexOf(b.name));

  const lineups = data?.lineups ?? [];
  // Map the two lineups to home/away by team name (both come from the same
  // fixture, so names match exactly); fall back to API-Football's order.
  let homeLineup = lineups.find((l) => l.team === data?.home_name) ?? null;
  let awayLineup = lineups.find((l) => l.team === data?.away_name) ?? null;
  if (!homeLineup && !awayLineup && lineups.length === 2) {
    [homeLineup, awayLineup] = lineups;
  }
  const hasXI = (l: RealLineup | null) => !!l && l.startXI.length > 0;

  return (
    <>
      {shown.length > 0 && (
        <section className="mt-8" aria-labelledby="match-stats-h">
          <h2 id="match-stats-h" className="flex items-center gap-2 display text-2xl text-primary">
            <BarChart3 size={20} aria-hidden="true" /> Match stats
          </h2>
          <motion.ul
            variants={staggerParent}
            initial={reduced ? false : "initial"}
            animate="animate"
            className="mt-4 space-y-3 rounded-2xl border border-border/60 bg-card/40 p-4"
          >
            {shown.map((s) => (
              <StatBar key={s.name} name={s.name} home={s.home} away={s.away} />
            ))}
          </motion.ul>
        </section>
      )}

      {(hasXI(homeLineup) || hasXI(awayLineup)) && (
        <section className="mt-8" aria-labelledby="lineups-h">
          <h2 id="lineups-h" className="flex items-center gap-2 display text-2xl text-primary">
            <Users size={20} aria-hidden="true" /> Lineups
          </h2>
          {hasXI(homeLineup) && hasXI(awayLineup) ? (
            <>
              <div className="mt-4">
                <CombinedPitch home={homeLineup!} away={awayLineup!} />
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <LineupMeta l={homeLineup!} align="left" />
                <LineupMeta l={awayLineup!} align="right" />
              </div>
            </>
          ) : (
            <div className="mt-4">
              <div className="relative mx-auto aspect-[2/3] w-full max-w-md overflow-hidden rounded-2xl border border-border/60">
                <PitchGraphic />
                <div className="absolute inset-0">
                  <FormationPitch startXI={(homeLineup ?? awayLineup)!.startXI} isHome />
                </div>
              </div>
              <div className="mt-3">
                <LineupMeta l={(homeLineup ?? awayLineup)!} align="left" />
              </div>
            </div>
          )}
        </section>
      )}
    </>
  );
}
