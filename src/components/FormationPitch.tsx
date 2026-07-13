import { useState } from "react";
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
 * Parses API-Football's "row:col" grid string into a row/col pair.
 * Row 1 is always the goalkeeper; higher rows push further upfield.
 */
function parseGrid(grid: string | null): { row: number; col: number } | null {
  if (!grid) return null;
  const [r, c] = grid.split(":").map(Number);
  if (!Number.isFinite(r) || !Number.isFinite(c)) return null;
  return { row: r, col: c };
}

/** One jersey token: number badge + surname, with a headshot on hover/focus. */
function JerseyToken({ p, flip, isHome }: { p: LineupPlayer; flip: boolean; isHome: boolean }) {
  const [open, setOpen] = useState(false);
  const surname = p.name.trim().split(" ").slice(-1)[0];

  return (
    <motion.div
      variants={staggerChild}
      className="group relative flex flex-col items-center gap-1"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={`${p.name}${p.number != null ? `, number ${p.number}` : ""}`}
        onClick={() => setOpen((v) => !v)}
        className={`relative grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-bold shadow-md ring-2 transition focus-visible:outline-none focus-visible:ring-4 sm:h-9 sm:w-9 sm:text-xs ${
          isHome
            ? "bg-primary text-primary-foreground ring-primary/40"
            : "bg-foreground text-background ring-foreground/30"
        }`}
      >
        {p.number ?? "–"}
      </button>
      <span
        className={`max-w-[4.5rem] truncate text-center text-[9px] font-semibold uppercase tracking-wide text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] sm:max-w-[5.5rem] sm:text-[10px] ${flip ? "" : ""}`}
      >
        {surname}
      </span>

      {/* Headshot popover on tap/hover */}
      {open && (
        <div
          role="tooltip"
          className={`absolute z-20 flex w-32 -translate-x-1/2 flex-col items-center gap-1 rounded-xl border border-border bg-card p-2 text-center shadow-xl ${
            flip ? "bottom-full left-1/2 mb-2" : "top-full left-1/2 mt-2"
          }`}
        >
          <span className="h-14 w-14 overflow-hidden rounded-full bg-secondary ring-1 ring-border">
            {p.photo && (
              <img
                src={p.photo}
                alt=""
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            )}
          </span>
          <span className="text-xs font-semibold leading-tight text-foreground">{p.name}</span>
          <span className="text-[10px] text-muted-foreground">
            {p.pos ?? ""}
            {p.number != null ? ` · #${p.number}` : ""}
          </span>
        </div>
      )}
    </motion.div>
  );
}

/**
 * Renders a starting XI on a broadcast-style turf graphic, positioned by
 * formation using API-Football's grid coordinates. Falls back to an even
 * spread across rows if grid data is missing for a player.
 *
 * `flip` mirrors the team vertically so the two lineups face each other
 * (home attacks upward from the bottom, away attacks downward from the top)
 * — same convention broadcasters use for a combined lineup graphic.
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
  // Each team occupies its own half of the shared pitch: away on top, home on
  // bottom (see CombinedPitch). Rows render top-to-bottom via `justify-between`
  // within that half. For the away half that already puts row 1 (GK) at the
  // very top edge — correct, since away attacks downward and their goal is up.
  // For the home half we need the opposite: row 1 (GK) at the very *bottom*
  // edge (their own goal), with attackers nearest the halfway line in the
  // middle. So the home team's rows are reversed here; `flip` marks the away
  // team and is passed through to JerseyToken only for tooltip placement.
  const finalRows = flip ? orderedRows : orderedRows.slice().reverse();

  return (
    <motion.div
      variants={staggerParent}
      initial={reduced ? false : "initial"}
      animate="animate"
      className="flex h-full w-full flex-col justify-between gap-3 px-2 py-4 sm:gap-4 sm:px-4"
    >
      {finalRows.map(([rowNum, players]) => (
        <div key={rowNum} className="flex items-start justify-evenly gap-1">
          {players.map((p, i) => (
            <JerseyToken key={p.id ?? `${rowNum}-${i}`} p={p} flip={flip} isHome={isHome} />
          ))}
        </div>
      ))}
    </motion.div>
  );
}
