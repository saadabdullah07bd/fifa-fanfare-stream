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
      whileHover={{ scale: 1.08, zIndex: 20 }}
      className="relative flex flex-col items-center gap-1"
      title={`${p.name}${p.number != null ? ` · #${p.number}` : ""}${p.pos ? ` · ${p.pos}` : ""}`}
    >
      {/* soft grounding shadow so tokens read as standing on the turf */}
      <span
        aria-hidden="true"
        className="absolute top-8 h-1.5 w-8 rounded-[100%] bg-black/40 blur-[3px] sm:top-10 sm:w-10"
      />
      <div
        className={`relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gradient-to-b from-secondary to-secondary/70 shadow-lg ring-2 sm:h-12 sm:w-12 ${
          isHome ? "ring-primary" : "ring-white"
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
        <span className="absolute inset-0 -z-10 grid place-items-center text-[10px] font-bold text-muted-foreground">
          {initials}
        </span>
        {/* subtle inner sheen for a more three-dimensional token */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/25 to-transparent"
        />
        {/* Number badge, bottom-right of the headshot */}
        <span
          className={`absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full text-[8px] font-black shadow-sm ring-1 sm:h-5 sm:w-5 sm:text-[10px] ${
            isHome
              ? "bg-primary text-primary-foreground ring-primary/40"
              : "bg-foreground text-background ring-foreground/30"
          }`}
        >
          {p.number ?? "–"}
        </span>
      </div>
      <span className="max-w-[4.5rem] truncate rounded-full bg-black/45 px-1.5 py-px text-center text-[9px] font-semibold uppercase tracking-wide text-white backdrop-blur-[1px] sm:max-w-[5.5rem] sm:text-[10px]">
        {surname}
      </span>
    </motion.div>
  );
}

/**
 * Depth of each formation line from the team's own goal-line (0) to the
 * halfway line (1). The keeper hugs the goal; the outfield lines fan out with
 * a slightly compressed defence and an advanced front line, matching how real
 * broadcast formation graphics are drawn (rather than evenly-spaced rows).
 */
function depthForRow(idx: number, rowCount: number): number {
  if (rowCount <= 1) return 0.5;
  if (idx === 0) return 0.08; // goalkeeper hugs the goal line
  const outfield = rowCount - 1; // number of outfield lines
  const t = outfield === 1 ? 0.5 : (idx - 1) / (outfield - 1); // 0..1 back→front
  // Ease so the defensive line sits a touch deeper and attackers press high.
  const eased = 0.28 + t * 0.66;
  return Math.min(0.95, eased);
}

/**
 * Renders a starting XI on a broadcast-style turf graphic, positioning each
 * player by absolute percentage so the lines have realistic depth (keeper on
 * the goal-line, forwards near halfway) instead of an even vertical spread.
 *
 * `flip` mirrors the team so the two lineups face each other — the home side
 * attacks upward from the bottom half, the away side downward from the top.
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
  const rowCount = orderedRows.length;

  return (
    <motion.div
      variants={staggerParent}
      initial={reduced ? false : "initial"}
      animate="animate"
      className="relative h-full w-full"
    >
      {orderedRows.map(([rowNum, players], idx) => {
        const depth = depthForRow(idx, rowCount);
        // Map depth (0 = own goal, 1 = halfway) into a safe band inside the
        // half so tokens near the goal-line don't clip the pitch edge. Own goal
        // sits at the outer edge of each half: the top half (away, flip)
        // measures from the top, the bottom half (home) from the bottom.
        const posFromOuter = 0.08 + depth * 0.84;
        const yFrac = flip ? posFromOuter : 1 - posFromOuter;
        const count = players.length;
        return players.map((p, i) => {
          // Spread across the width with margins; nudge wingers slightly wider
          // than an even split so full lines don't look mechanically uniform.
          const base = (i + 1) / (count + 1);
          const spread = count > 2 ? (base - 0.5) * 1.12 + 0.5 : base;
          const xFrac = Math.min(0.92, Math.max(0.08, spread));
          return (
            <div
              key={p.id ?? `${rowNum}-${i}`}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${xFrac * 100}%`, top: `${yFrac * 100}%` }}
            >
              <JerseyToken p={p} isHome={isHome} />
            </div>
          );
        });
      })}
    </motion.div>
  );
}
