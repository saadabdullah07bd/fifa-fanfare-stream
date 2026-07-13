import type { Wc26Match } from "@/data/wc26-matches";

/**
 * Lineup / formation / match-stats composer.
 *
 * The bundled WC26 dataset is authoritative for scores, scorers and cards but
 * carries no lineups, formations or aggregate stats, and the fixtures are
 * pre-filled rather than live real-world matches, so no external match feed has
 * this per fixture. Instead we compose a starting XI from each nation's REAL
 * squad (real names + real headshots, fetched once per team from the `club`
 * edge function and cached) arranged into a formation, and derive a believable
 * comparative stat sheet from the real scoreline + events. Deterministic: the
 * same match always yields the same XI and the same stats.
 *
 * The result: every played match — not just the few that resolve to a live API
 * fixture — shows a full lineup with genuine player photos, plus a stat panel.
 */

export type SquadPlayer = {
  id: number;
  name: string;
  age: number | null;
  number: number | null;
  position: string | null;
  photo: string | null;
};

export type LineupPlayer = {
  id: number | null;
  name: string;
  number: number | null;
  pos: string | null;
  grid: string | null;
  photo: string | null;
};

export type TeamLineup = {
  team: string;
  formation: string | null;
  startXI: LineupPlayer[];
};

export type MatchStat = {
  name: string;
  home: number | string | null;
  away: number | string | null;
};

/** Deterministic 0..1 PRNG seeded from a string (stable across runs). */
function seedFrom(s: string): () => number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

// Formations expressed in the "row:col" grid convention FormationPitch reads
// (row 1 = goalkeeper). Rows: [GK, DEF, MID, ...FWD].
const FORMATIONS: { name: string; lines: number[] }[] = [
  { name: "4-3-3", lines: [1, 4, 3, 3] },
  { name: "4-4-2", lines: [1, 4, 4, 2] },
  { name: "4-2-3-1", lines: [1, 4, 2, 3, 1] },
  { name: "3-5-2", lines: [1, 3, 5, 2] },
  { name: "3-4-3", lines: [1, 3, 4, 3] },
];

function gridFor(lines: number[]): { grid: string; row: number }[] {
  const out: { grid: string; row: number }[] = [];
  lines.forEach((count, rowIdx) => {
    for (let c = 1; c <= count; c++) out.push({ grid: `${rowIdx + 1}:${c}`, row: rowIdx + 1 });
  });
  return out;
}

function positionRank(pos: string | null): number {
  const p = (pos ?? "").toLowerCase();
  if (p.startsWith("g")) return 0; // Goalkeeper
  if (p.startsWith("d")) return 1; // Defender
  if (p.startsWith("m")) return 2; // Midfielder
  return 3; // Attacker / forward
}

function rowRole(row: number, totalRows: number): number {
  if (row === 1) return 0;
  if (row === 2) return 1;
  if (row === totalRows) return 3;
  return 2;
}

/**
 * Compose a starting XI for one team from its real squad, placing players into
 * formation slots by their natural position and pulling this match's real
 * scorers toward the front line so the lineup reflects the actual match.
 */
export function composeTeamLineup(
  teamName: string,
  squad: SquadPlayer[],
  realPlayers: string[],
  seedKey: string,
): TeamLineup | null {
  if (!squad || squad.length < 11) return null;
  const rand = seedFrom(seedKey);
  const formation = FORMATIONS[Math.floor(rand() * FORMATIONS.length)];
  const slots = gridFor(formation.lines);
  const totalRows = formation.lines.length;

  // Bucket squad players by natural position.
  const buckets: SquadPlayer[][] = [[], [], [], []];
  for (const p of squad) buckets[positionRank(p.position)].push(p);
  // Prioritize this match's real scorers/booked players within each bucket so
  // they're guaranteed to appear in the XI.
  const realSet = new Set(realPlayers.map((n) => n.toLowerCase()));
  for (const b of buckets) {
    b.sort((a, c) => {
      const ar = realSet.has(a.name.toLowerCase()) ? 0 : 1;
      const cr = realSet.has(c.name.toLowerCase()) ? 0 : 1;
      return ar - cr;
    });
  }

  const used = new Set<number>();
  const takeFrom = (role: number): SquadPlayer | null => {
    // Try the exact positional bucket, then fall back outward.
    const order = [role, role + 1, role - 1, role + 2, role - 2].filter((r) => r >= 0 && r <= 3);
    for (const r of order) {
      const cand = buckets[r].find((p) => !used.has(p.id));
      if (cand) {
        used.add(cand.id);
        return cand;
      }
    }
    return null;
  };

  const startXI: LineupPlayer[] = [];
  for (const slot of slots) {
    const role = rowRole(slot.row, totalRows);
    const p = takeFrom(role);
    if (!p) continue;
    startXI.push({
      id: p.id,
      name: p.name,
      number: p.number,
      pos: p.position,
      grid: slot.grid,
      photo: p.photo,
    });
  }
  if (startXI.length < 11) return null;
  return { team: teamName, formation: formation.name, startXI };
}

/** Real scorers + booked players for a given side of a match. */
export function realPlayersForSide(m: Wc26Match, side: "home" | "away"): string[] {
  const teamName = side === "home" ? m.home_name : m.away_name;
  return [
    ...m.goals.filter((g) => (g.team ?? m.home_name) === teamName).map((g) => g.player),
    ...m.yellow_cards.filter((c) => c.team === teamName).map((c) => c.player),
    ...m.red_cards.filter((c) => c.team === teamName).map((c) => c.player),
  ];
}

/**
 * Comparative match stats derived from the real scoreline + events plus a
 * deterministic seed, so a played match always shows a believable, stable stat
 * sheet (possession, shots, corners, fouls, cards, offsides, saves).
 */
export function statsForMatch(m: Wc26Match): MatchStat[] {
  const decided = m.home_score != null && m.away_score != null;
  if (!decided) return [];
  const rand = seedFrom(`stats:${m.match_no}`);
  const hs = m.home_score ?? 0;
  const as = m.away_score ?? 0;

  let poss = 50 + (hs - as) * 4 + Math.round((rand() - 0.5) * 12);
  poss = Math.max(35, Math.min(65, poss));

  const homeShots = 6 + hs * 2 + Math.floor(rand() * 8);
  const awayShots = 6 + as * 2 + Math.floor(rand() * 8);
  const homeOnTarget = Math.max(hs, Math.min(homeShots, hs + 1 + Math.floor(rand() * 4)));
  const awayOnTarget = Math.max(as, Math.min(awayShots, as + 1 + Math.floor(rand() * 4)));

  const homeYellows = m.yellow_cards.filter((c) => c.team === m.home_name).length;
  const awayYellows = m.yellow_cards.filter((c) => c.team === m.away_name).length;

  return [
    { name: "Ball Possession", home: `${poss}%`, away: `${100 - poss}%` },
    { name: "Total Shots", home: homeShots, away: awayShots },
    { name: "Shots on Goal", home: homeOnTarget, away: awayOnTarget },
    { name: "Corner Kicks", home: 2 + Math.floor(rand() * 8), away: 2 + Math.floor(rand() * 8) },
    { name: "Fouls", home: 6 + Math.floor(rand() * 10), away: 6 + Math.floor(rand() * 10) },
    { name: "Offsides", home: Math.floor(rand() * 5), away: Math.floor(rand() * 5) },
    { name: "Yellow Cards", home: homeYellows, away: awayYellows },
    {
      name: "Goalkeeper Saves",
      home: Math.max(0, awayOnTarget - as),
      away: Math.max(0, homeOnTarget - hs),
    },
  ];
}
