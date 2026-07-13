import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { BarChart3, Users } from "lucide-react";
import { staggerParent, staggerChild, useReducedMotionSafe } from "@/lib/motion";
import PitchGraphic from "@/components/PitchGraphic";
import FormationPitch from "@/components/FormationPitch";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/match-stats`;

type LineupPlayer = {
  id: number | null;
  name: string;
  number: number | null;
  pos: string | null;
  grid: string | null;
  photo: string | null;
};

type Lineup = {
  team: string;
  formation: string | null;
  coach: string | null;
  startXI: LineupPlayer[];
  substitutes: LineupPlayer[];
};

type StatsResponse = {
  available: boolean;
  stats: { name: string; home: number | string | null; away: number | string | null }[];
  lineups: Lineup[];
  home_name?: string;
  away_name?: string;
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
  "Passes accurate",
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

/** One player row with headshot + graceful initials fallback. */
function PlayerRow({ p }: { p: LineupPlayer }) {
  const initials = p.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <li className="flex min-w-0 items-center gap-2 py-1">
      <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-secondary ring-1 ring-border">
        {p.photo && (
          <img
            src={p.photo}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        )}
        <span className="absolute inset-0 -z-10 grid place-items-center text-[9px] font-bold text-muted-foreground">
          {initials}
        </span>
      </span>
      <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {p.number ?? ""}
      </span>
      <span className="truncate text-sm">{p.name}</span>
      {p.pos && (
        <span className="ml-auto shrink-0 text-[10px] uppercase text-muted-foreground/70">
          {p.pos}
        </span>
      )}
    </li>
  );
}

/** Compact per-team card: formation, coach, and the bench (the pitch graphic
 * already shows the starting XI, so this only needs the supporting info). */
function LineupMeta({ l, align }: { l: Lineup; align: "left" | "right" }) {
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
      {l.coach && <p className="mt-0.5 truncate text-xs text-muted-foreground">Coach: {l.coach}</p>}
      {l.substitutes.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Substitutes ({l.substitutes.length})
          </summary>
          <ul className="mt-2 divide-y divide-border/40 text-left">
            {l.substitutes.map((p, i) => (
              <PlayerRow key={p.id ?? i} p={p} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/**
 * Broadcast-style combined lineup graphic: both starting XIs on one turf,
 * facing each other — the home side (gold jerseys) attacking up from the
 * bottom, the away side (white jerseys) attacking down from the top.
 */
function CombinedPitch({ home, away }: { home: Lineup; away: Lineup }) {
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

/**
 * Live match statistics + lineups (with real player headshots), fetched from
 * the match-stats edge function (API-Football). Renders nothing when the
 * provider has no data for this fixture, so upcoming matches stay clean.
 */
export default function MatchStatsPanel({
  home,
  away,
  date,
  enabled,
}: {
  home: string;
  away: string;
  date: string | null;
  enabled: boolean;
}) {
  const reduced = useReducedMotionSafe();
  const { data } = useQuery<StatsResponse>({
    queryKey: ["match-stats", home, away, date],
    enabled: enabled && !!home && !!away,
    staleTime: 60_000,
    queryFn: async () => {
      const qs = new URLSearchParams({ home, away, ...(date ? { date } : {}) });
      const res = await fetch(`${FN_URL}?${qs}`);
      if (!res.ok) throw new Error(`match-stats ${res.status}`);
      return (await res.json()) as StatsResponse;
    },
  });

  if (!data?.available) return null;

  const shown = (data.stats ?? [])
    .filter((s) => STAT_WHITELIST.includes(s.name))
    .sort((a, b) => STAT_WHITELIST.indexOf(a.name) - STAT_WHITELIST.indexOf(b.name));

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

      {(data.lineups?.length ?? 0) > 0 &&
        (() => {
          const homeLineup = data.lineups.find((l) => l.team === data.home_name) ?? data.lineups[0];
          const awayLineup =
            data.lineups.find((l) => l.team === data.away_name) ??
            data.lineups.find((l) => l.team !== homeLineup.team) ??
            data.lineups[1];
          return (
            <section className="mt-8" aria-labelledby="lineups-h">
              <h2 id="lineups-h" className="flex items-center gap-2 display text-2xl text-primary">
                <Users size={20} aria-hidden="true" /> Lineups
              </h2>
              {awayLineup && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Tap a jersey number to see the player. Gold is {homeLineup.team}, white is{" "}
                  {awayLineup.team}.
                </p>
              )}
              <div className="mt-4">
                {awayLineup ? (
                  <CombinedPitch home={homeLineup} away={awayLineup} />
                ) : (
                  <div className="relative mx-auto aspect-[2/3] w-full max-w-md overflow-hidden rounded-2xl border border-border/60">
                    <PitchGraphic />
                    <div className="absolute inset-0">
                      <FormationPitch startXI={homeLineup.startXI} isHome />
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <LineupMeta l={homeLineup} align="left" />
                {awayLineup && <LineupMeta l={awayLineup} align="right" />}
              </div>
            </section>
          );
        })()}
    </>
  );
}
