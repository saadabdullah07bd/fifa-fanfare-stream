import { useQueries } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { BarChart3, Users } from "lucide-react";
import { staggerParent, staggerChild, useReducedMotionSafe } from "@/lib/motion";
import PitchGraphic from "@/components/PitchGraphic";
import FormationPitch from "@/components/FormationPitch";
import { supabase } from "@/integrations/supabase/client";
import type { Wc26Match } from "@/data/wc26-matches";
import {
  composeTeamLineup,
  realPlayersForSide,
  statsForMatch,
  type SquadPlayer,
  type TeamLineup,
} from "@/lib/lineup";

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

/** Compact per-team meta card: team name + formation. */
function LineupMeta({ l, align }: { l: TeamLineup; align: "left" | "right" }) {
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
    </div>
  );
}

/**
 * Broadcast-style combined lineup graphic: both starting XIs on one turf,
 * facing each other — the home side (gold jerseys) attacking up from the
 * bottom, the away side (white jerseys) attacking down from the top.
 */
function CombinedPitch({ home, away }: { home: TeamLineup; away: TeamLineup }) {
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

/** Fetch one nation's real squad (names + headshots) via the club function. */
function useSquad(name: string) {
  return {
    queryKey: ["squad", name],
    staleTime: 24 * 3600_000,
    gcTime: 24 * 3600_000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("club", {
        body: { action: "squad", name },
      });
      if (error) throw error;
      return (data as { squad: SquadPlayer[] })?.squad ?? [];
    },
  };
}

/**
 * Match stats + lineups for EVERY played match. Stats are derived from the real
 * scoreline/events (offline, deterministic). Lineups are composed from each
 * nation's REAL squad — genuine player names and headshots, shown directly on
 * the pitch — arranged into a formation with this match's actual scorers slotted
 * in. Squads load from the club edge function and are cached for a day.
 */
export default function MatchStatsPanel({ match }: { match: Wc26Match }) {
  const reduced = useReducedMotionSafe();
  const decided = match.home_score != null && match.away_score != null;

  const [homeQ, awayQ] = useQueries({
    queries: [useSquad(match.home_name), useSquad(match.away_name)],
  });

  const stats = decided ? statsForMatch(match) : [];
  const shown = stats
    .filter((s) => STAT_WHITELIST.includes(s.name))
    .sort((a, b) => STAT_WHITELIST.indexOf(a.name) - STAT_WHITELIST.indexOf(b.name));

  const homeSquad = homeQ.data ?? [];
  const awaySquad = awayQ.data ?? [];
  const homeLineup =
    homeSquad.length >= 11
      ? composeTeamLineup(
          match.home_name,
          homeSquad,
          realPlayersForSide(match, "home"),
          `${match.match_no}:home`,
        )
      : null;
  const awayLineup =
    awaySquad.length >= 11
      ? composeTeamLineup(
          match.away_name,
          awaySquad,
          realPlayersForSide(match, "away"),
          `${match.match_no}:away`,
        )
      : null;

  const lineupsLoading = homeQ.isLoading || awayQ.isLoading;

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

      {(homeLineup || awayLineup || lineupsLoading) && (
        <section className="mt-8" aria-labelledby="lineups-h">
          <h2 id="lineups-h" className="flex items-center gap-2 display text-2xl text-primary">
            <Users size={20} aria-hidden="true" /> Lineups
          </h2>
          {lineupsLoading ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Loading lineups &amp; player photos…
            </p>
          ) : homeLineup && awayLineup ? (
            <>
              <div className="mt-4">
                <CombinedPitch home={homeLineup} away={awayLineup} />
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <LineupMeta l={homeLineup} align="left" />
                <LineupMeta l={awayLineup} align="right" />
              </div>
            </>
          ) : homeLineup || awayLineup ? (
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
          ) : null}
        </section>
      )}
    </>
  );
}
