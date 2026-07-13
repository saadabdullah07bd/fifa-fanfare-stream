import { motion } from "framer-motion";
import { staggerParent, staggerChild, useReducedMotionSafe } from "@/lib/motion";

type LineupPlayer = {
  id: number | null;
  name: string;
  number: number | null;
  pos: string | null;
  grid: string | null;
  photo: string | null;
};

/**
 * Parses the "row:col" grid string into a row/col pair.
 * Row 1 is always the goalkeeper; higher rows push further upfield.
 */
function parseGrid(grid: string | null): { row: number; col: number } | null {
  if (!grid) return null;
  const [r, c] = grid.split(":").map(Number);
  if (!Number.isFinite(r) || !Number.isFinite(c)) return null;
  return { row: r, col: c };
}

/** One player token: headshot (shown directly) + number badge + surname. */
function JerseyToken({ p, isHome }: { p: LineupPlayer; isHome: boolean }) {
  const surname = p.name.trim().split(" ").slice(-1)[0];
  const initials = p.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <motion.div
      variants={staggerChild}
      className="relative flex flex-col items-center gap-1"
      title={`${p.name}${p.number != null ? ` · #${p.number}` : ""}${p.pos ? ` · ${p.pos}` : ""}`}
    >
      <div
        className={`relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-secondary shadow-md ring-2 sm:h-11 sm:w-11 ${
          isHome ? "ring-primary/70" : "ring-white/70"
        }`}
      >
        {p.photo ? (
          <img
            src={p.photo}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : null}
        <span className="absolute inset-0 -z-10 grid place-items-center text-[9px] font-bold text-muted-foreground">
          {initials}
        </span>
        {/* Number badge, bottom-right of the headshot */}
        <span
          className={`absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full text-[8px] font-black ring-1 sm:h-5 sm:w-5 sm:text-[10px] ${
            isHome
              ? "bg-primary text-primary-foreground ring-primary/40"
              : "bg-foreground text-background ring-foreground/30"
          }`}
        >
          {p.number ?? "–"}
        </span>
      </div>
      <span className="max-w-[4.5rem] truncate text-center text-[9px] font-semibold uppercase tracking-wide text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] sm:max-w-[5.5rem] sm:text-[10px]">
        {surname}
      </span>
    </motion.div>
  );
}

/**
 * Renders a starting XI on a broadcast-style turf graphic, positioned by
 * formation using the grid coordinates. Falls back to an even spread across
 * rows if grid data is missing for a player.
 *
 * `flip` mirrors the team vertically so the two lineups face each other
 * (home attacks upward from the bottom, away attacks downward from the top).
 */
export default function FormationPitch({
  startXI,
  isHome,
  flip = false,
}: {
  startXI: LineupPlayer[];
  isHome: boolean;
  flip?: boolean;
}) {
  const reduced = useReducedMotionSafe();

  // Group players by row (defensive line, midfield line, etc).
  const rows = new Map<number, LineupPlayer[]>();
  let autoRow = 1;
  for (const p of startXI) {
    const g = parseGrid(p.grid);
    const row = g?.row ?? autoRow++;
    if (!rows.has(row)) rows.set(row, []);
    rows.get(row)!.push(p);
  }
  // Sort each row by column so players read left-to-right consistently.
  for (const [, players] of rows) {
    players.sort((a, b) => (parseGrid(a.grid)?.col ?? 0) - (parseGrid(b.grid)?.col ?? 0));
  }
  const orderedRows = Array.from(rows.entries()).sort(([a], [b]) => a - b);
  // The home team's rows are reversed so row 1 (GK) sits at the bottom edge
  // (their own goal); `flip` marks the away team (rows already top-down).
  const finalRows = flip ? orderedRows : orderedRows.slice().reverse();

  return (
    <motion.div
      variants={staggerParent}
      initial={reduced ? false : "initial"}
      animate="animate"
      className="flex h-full w-full flex-col justify-between gap-2 px-2 py-3 sm:gap-3 sm:px-4"
    >
      {finalRows.map(([rowNum, players]) => (
        <div key={rowNum} className="flex items-start justify-evenly gap-1">
          {players.map((p, i) => (
            <JerseyToken key={p.id ?? `${rowNum}-${i}`} p={p} isHome={isHome} />
          ))}
        </div>
      ))}
    </motion.div>
  );
}
