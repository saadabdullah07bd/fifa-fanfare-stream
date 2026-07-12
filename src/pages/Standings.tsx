import { useEffect, useMemo, useState } from "react";
import { Seo } from "@/lib/seo";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Users, Search, Medal, Target } from "lucide-react";
import { flagUrl } from "@/lib/flags";


type Row = {
  position: number;
  team: { name: string; tla?: string; crest?: string };
  played: number; won: number; draw: number; lost: number;
  points: number; gf: number; ga: number; gd: number; form?: string;
};
type Group = { group: string | null; stage: string; type: string; table: Row[] };
type Scorer = {
  player: { name: string; nationality?: string };
  team: { name: string; tla?: string; crest?: string };
  goals: number; assists?: number; penalties?: number; played?: number;
};

function titleCase(value: string) {
  return value.toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
}
function cleanCompetitionLabel(value: string | null | undefined) {
  return (value ?? "").replace(/^GROUP[_\s-]*/i, "").replace(/_/g, " ").trim();
}
function groupTitle(group: string | null | undefined, stage: string | null | undefined) {
  const label = cleanCompetitionLabel(group || stage);
  if (!label) return "Group";
  if (/^group\b/i.test(label)) return titleCase(label);
  return `Group ${titleCase(label)}`;
}
function stageTitle(stage: string | null | undefined) {
  const label = (stage ?? "").replace(/_/g, " ").trim();
  return label ? titleCase(label) : "";
}

const SOURCE_LABELS: Record<string, string> = {
  WCQ: "World Cup Qualifying", CL: "UEFA Champions League", EL: "UEFA Europa League",
  PL: "Premier League", PD: "LaLiga", SA: "Serie A", BL1: "Bundesliga",
  FL1: "Ligue 1", CLI: "Copa Libertadores",
};

/**
 * Tournament standings and top scorers page — Premium Broadcast layout.
 */
export default function Standings() {
  const [tab, setTab] = useState<"standings" | "scorers">("standings");
  const [groups, setGroups] = useState<Group[]>([]);
  const [scorers, setScorers] = useState<Scorer[]>([]);
  const [scorersSource, setScorersSource] = useState<string>("");
  const [updated, setUpdated] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [scorerQuery, setScorerQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    const CACHE_KEY = "pitch26:standings-cache-v1";
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const c = JSON.parse(raw) as { standings: Group[]; scorers: Scorer[]; scorers_source: string; updated_at: string };
        setGroups(c.standings ?? []);
        setScorers(c.scorers ?? []);
        setScorersSource(c.scorers_source ?? "");
        setUpdated(c.updated_at ?? "");
        setLoading(false);
      }
    } catch { /* ignore */ }

    (async () => {
      const { data, error } = await supabase.functions.invoke("standings", { body: { kind: "all" } });
      if (cancelled) return;
      if (error) { setErr(error.message); setLoading(false); return; }
      const d = data as { standings?: Group[]; scorers?: Scorer[]; scorers_source?: string; updated_at?: string };
      const payload = {
        standings: d.standings ?? [],
        scorers: d.scorers ?? [],
        scorers_source: d.scorers_source ?? "",
        updated_at: d.updated_at ?? "",
      };
      setGroups(payload.standings);
      setScorers(payload.scorers);
      setScorersSource(payload.scorers_source);
      setUpdated(payload.updated_at);
      setLoading(false);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(payload)); } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredScorers = useMemo(() => {
    const q = scorerQuery.trim().toLowerCase();
    if (!q) return scorers;
    return scorers.filter(
      (s) => s.player.name.toLowerCase().includes(q) || s.team.name.toLowerCase().includes(q),
    );
  }, [scorers, scorerQuery]);

  const updatedLabel = useMemo(() => {
    if (!updated) return "";
    try { return new Date(updated).toLocaleString(); } catch { return updated; }
  }, [updated]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 pb-16 sm:py-8">
      <Seo
        title="FIFA World Cup 2026 Standings, Groups & Top Scorers Live | Pitch26"
        description="Live FIFA World Cup 2026 group standings, points table and Golden Boot top scorers leaderboard, updated after every match."
        path="/standings"
      />

      {/* Editorial header */}
      <header className="relative overflow-hidden rounded-3xl border border-border bg-card/60 p-5 sm:p-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(60% 80% at 100% 0%, hsl(var(--primary) / 0.18), transparent 60%), radial-gradient(50% 70% at 0% 100%, hsl(var(--trophy-green,142 55% 27%) / 0.25), transparent 60%)",
          }}
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-primary">
              <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Points & Golden Boot · WC 2026</span>
            </div>
            <motion.h1
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              className="display mt-2 text-4xl leading-none sm:text-6xl md:text-7xl"
            >
              Standings &amp; Stats
            </motion.h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Group tables and Golden Boot rankings — updated after every kickoff.
            </p>
            {updatedLabel && (
              <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Last updated · {updatedLabel}
              </p>
            )}
          </div>

          {/* Tab switch */}
          <div
            role="tablist"
            aria-label="View standings or top scorers"
            className="inline-flex self-start rounded-full border border-border bg-background/60 p-1 sm:self-end"
          >
            {([
              { k: "standings" as const, label: "Groups", icon: Users },
              { k: "scorers" as const, label: "Top scorers", icon: Medal },
            ]).map(({ k, label, icon: Icon }) => {
              const on = tab === k;
              return (
                <button
                  key={k}
                  role="tab"
                  aria-selected={on}
                  onClick={() => setTab(k)}
                  className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    on ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {loading ? (
        <div
          className="mt-6 grid gap-5 md:grid-cols-2"
          role="status"
          aria-live="polite"
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-3xl bg-card/40" />
          ))}
          <span className="sr-only">Loading standings…</span>
        </div>
      ) : err ? (
        <div className="mt-6 rounded-3xl border border-destructive/40 bg-destructive/10 p-6 text-center text-sm text-destructive">
          {err}
        </div>
      ) : tab === "standings" ? (
        <section role="tabpanel" aria-label="Group tables" className="mt-6">
          {groups.length === 0 ? (
            <div className="rounded-3xl border border-border bg-card/40 p-10 text-center">
              <Users className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
              <p className="mt-3 text-sm text-muted-foreground">
                No group data yet — the draw has not been staged.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {groups.map((g, index) => (
                <GroupCard key={`${g.group ?? "group"}-${g.stage}-${index}`} group={g} index={index} />
              ))}
            </div>
          )}

          {/* Legend */}
          {groups.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" /> Advance
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" /> Positive GD
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-400" aria-hidden="true" /> Negative GD
              </span>
            </div>
          )}
        </section>
      ) : (
        <ScorersPanel
          scorers={filteredScorers}
          totalCount={scorers.length}
          scorersSource={scorersSource}
          query={scorerQuery}
          setQuery={setScorerQuery}
        />
      )}
    </div>
  );
}

/* ---------- Group table card ---------- */

function GroupCard({ group: g, index }: { group: Group; index: number }) {
  const topPoints = Math.max(1, ...g.table.map((r) => r.points));
  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.2) }}
      className="overflow-hidden rounded-3xl border border-border bg-card/50 shadow-md"
    >
      <header className="flex items-center justify-between gap-3 border-b border-border/60 bg-secondary/30 px-4 py-3">
        <h2 className="display flex items-center gap-2 text-xl tracking-wider text-primary sm:text-2xl">
          <span className="inline-block h-5 w-1 rounded bg-primary" aria-hidden="true" />
          {groupTitle(g.group, g.stage)}
        </h2>
        <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {stageTitle(g.stage)}
        </span>
      </header>

      {/* Desktop table */}
      <table className="hidden w-full text-sm sm:table">
        <caption className="sr-only">{groupTitle(g.group, g.stage)} points table</caption>
        <thead className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <tr className="border-b border-border/60">
            <th scope="col" className="w-10 py-2.5 pl-3 text-left">#</th>
            <th scope="col" className="py-2.5 text-left">Team</th>
            <th scope="col" className="py-2.5 text-center" title="Played">P</th>
            <th scope="col" className="py-2.5 text-center" title="Won">W</th>
            <th scope="col" className="py-2.5 text-center" title="Drawn">D</th>
            <th scope="col" className="py-2.5 text-center" title="Lost">L</th>
            <th scope="col" className="py-2.5 text-center" title="Goal difference">GD</th>
            <th scope="col" className="py-2.5 pr-3 text-center font-bold text-primary">Pts</th>
          </tr>
        </thead>
        <tbody>
          {g.table.map((r) => (
            <tr
              key={r.team.name}
              className={`border-b border-border/40 tabular-nums transition-colors last:border-0 hover:bg-primary/5 ${
                r.position <= 2 ? "bg-primary/[0.03]" : ""
              }`}
            >
              <td className="py-2.5 pl-3">
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                    r.position <= 2
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground"
                  }`}
                  aria-label={`Position ${r.position}`}
                >
                  {r.position}
                </span>
              </td>
              <td className="py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  {(() => {
                    const flag = r.team.crest ?? flagUrl(r.team.tla, 80);
                    return flag ? (
                      <img src={flag} alt="" className="h-4 w-6 shrink-0 rounded-[2px] object-cover ring-1 ring-border" loading="lazy" />
                    ) : (
                      <span className="h-4 w-6 shrink-0 rounded-[2px] bg-secondary/40" aria-hidden="true" />
                    );
                  })()}
                  <span className="truncate font-medium">{r.team.name}</span>

                </div>
              </td>
              <td className="py-2.5 text-center text-muted-foreground">{r.played}</td>
              <td className="py-2.5 text-center">{r.won}</td>
              <td className="py-2.5 text-center">{r.draw}</td>
              <td className="py-2.5 text-center">{r.lost}</td>
              <td className={`py-2.5 text-center ${r.gd > 0 ? "text-emerald-400" : r.gd < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                {r.gd > 0 ? "+" : ""}{r.gd}
              </td>
              <td className="py-2.5 pr-3 text-center">
                <span className="inline-flex min-w-[2rem] justify-center rounded-md bg-primary/10 px-2 py-0.5 font-bold text-primary">
                  {r.points}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile stacked list */}
      <ul className="divide-y divide-border/40 sm:hidden">
        {g.table.map((r) => (
          <li key={r.team.name} className={`flex items-center gap-3 px-4 py-3 tabular-nums ${r.position <= 2 ? "bg-primary/[0.03]" : ""}`}>
            <span
              className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                r.position <= 2 ? "bg-primary/15 text-primary" : "bg-secondary/40 text-muted-foreground"
              }`}
              aria-label={`Position ${r.position}`}
            >
              {r.position}
            </span>
            {(() => {
              const flag = r.team.crest ?? flagUrl(r.team.tla, 80);
              return flag ? (
                <img src={flag} alt="" className="h-4 w-6 shrink-0 rounded-[2px] object-cover ring-1 ring-border" loading="lazy" />
              ) : (
                <span className="h-4 w-6 shrink-0 rounded-[2px] bg-secondary/40" aria-hidden="true" />
              );
            })()}

            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-semibold">{r.team.name}</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                P {r.played} · W {r.won} · D {r.draw} · L {r.lost} ·{" "}
                <span className={r.gd > 0 ? "text-emerald-400" : r.gd < 0 ? "text-red-400" : ""}>
                  GD {r.gd > 0 ? "+" : ""}{r.gd}
                </span>
              </p>
              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-secondary/40" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-primary/70"
                  style={{ width: `${Math.max(4, (r.points / topPoints) * 100)}%` }}
                />
              </div>
            </div>
            <span className="display shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-lg text-primary">
              {r.points}
            </span>
          </li>
        ))}
      </ul>
    </motion.article>
  );
}

/* ---------- Top scorers ---------- */

function ScorersPanel({
  scorers, totalCount, scorersSource, query, setQuery,
}: {
  scorers: Scorer[];
  totalCount: number;
  scorersSource: string;
  query: string;
  setQuery: (v: string) => void;
}) {
  const [first, second, third, ...rest] = scorers;
  const maxGoals = Math.max(1, ...scorers.map((s) => s.goals));
  const showAltSourceNote = scorersSource && !["WC", "WorldCupWiki", "Google"].includes(scorersSource);

  return (
    <section role="tabpanel" aria-label="Top scorers" className="mt-6 space-y-5">
      {showAltSourceNote && (
        <p className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-xs text-muted-foreground">
          Showing top scorers from{" "}
          <span className="font-bold text-primary">
            {SOURCE_LABELS[scorersSource] ?? scorersSource}
          </span>{" "}
          instead.
        </p>
      )}

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <label htmlFor="scorer-search" className="sr-only">Search scorers</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            id="scorer-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search player or team…"
            className="h-11 w-full rounded-full border border-border bg-background/70 pl-9 pr-4 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
        <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground tabular-nums">
          {scorers.length} of {totalCount}
        </span>
      </div>

      {scorers.length === 0 ? (
        <div className="rounded-3xl border border-border bg-card/40 p-10 text-center">
          <Target className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm text-muted-foreground">
            {totalCount === 0 ? "No goals recorded yet." : "No scorers match your search."}
          </p>
        </div>
      ) : (
        <>
          {/* Podium — top 3 */}
          {(first || second || third) && (
            <div className="grid gap-4 sm:grid-cols-3">
              {second && <PodiumCard scorer={second} place={2} maxGoals={maxGoals} />}
              {first && <PodiumCard scorer={first} place={1} maxGoals={maxGoals} />}
              {third && <PodiumCard scorer={third} place={3} maxGoals={maxGoals} />}
            </div>
          )}

          {/* Remaining leaderboard */}
          {rest.length > 0 && (
            <div className="overflow-hidden rounded-3xl border border-border bg-card/50">
              <table className="w-full text-sm">
                <caption className="sr-only">Top scorers leaderboard</caption>
                <thead className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  <tr className="border-b border-border/60">
                    <th scope="col" className="w-10 py-3 pl-4 text-left">#</th>
                    <th scope="col" className="py-3 text-left">Player</th>
                    <th scope="col" className="hidden py-3 text-left sm:table-cell">Team</th>
                    <th scope="col" className="hidden py-3 text-center md:table-cell" title="Matches played">P</th>
                    <th scope="col" className="hidden py-3 text-center md:table-cell" title="Assists">Ast</th>
                    <th scope="col" className="py-3 pr-4 text-center font-bold text-primary">Goals</th>
                  </tr>
                </thead>
                <tbody>
                  {rest.map((s, i) => (
                    <tr
                      key={s.player.name + i}
                      className="border-b border-border/40 tabular-nums transition-colors last:border-0 hover:bg-primary/5"
                    >
                      <td className="py-3 pl-4 text-muted-foreground">{i + 4}</td>
                      <td className="py-3">
                        <div className="font-medium">{s.player.name}</div>
                        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:hidden">
                          {s.team.name}
                        </div>
                      </td>
                      <td className="hidden py-3 sm:table-cell">
                        <div className="flex items-center gap-2 min-w-0">
                          {s.team.crest ? (
                            <img src={s.team.crest} alt="" className="h-4 w-6 shrink-0 rounded-[2px] object-cover ring-1 ring-border" loading="lazy" />
                          ) : (
                            <span className="h-4 w-6 shrink-0 rounded-[2px] bg-secondary/40" aria-hidden="true" />
                          )}
                          <span className="truncate">{s.team.name}</span>
                        </div>
                      </td>
                      <td className="hidden py-3 text-center text-muted-foreground md:table-cell">{s.played ?? "—"}</td>
                      <td className="hidden py-3 text-center md:table-cell">{s.assists ?? 0}</td>
                      <td className="py-3 pr-4 text-center">
                        <span className="inline-flex min-w-[2.25rem] justify-center rounded-md bg-primary/10 px-2 py-0.5 text-base font-bold text-primary">
                          {s.goals}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function PodiumCard({ scorer: s, place, maxGoals }: { scorer: Scorer; place: 1 | 2 | 3; maxGoals: number }) {
  const styles = {
    1: {
      ring: "border-primary/60 bg-gradient-to-br from-primary/10 via-card to-card",
      badge: "bg-primary text-primary-foreground",
      label: "Golden Boot",
      order: "sm:order-2",
      icon: <Trophy className="h-4 w-4" aria-hidden="true" />,
    },
    2: {
      ring: "border-border bg-card/60",
      badge: "bg-secondary/60 text-foreground",
      label: "Runner-up",
      order: "sm:order-1",
      icon: <Medal className="h-4 w-4" aria-hidden="true" />,
    },
    3: {
      ring: "border-border bg-card/60",
      badge: "bg-amber-900/40 text-amber-200",
      label: "Third",
      order: "sm:order-3",
      icon: <Medal className="h-4 w-4" aria-hidden="true" />,
    },
  }[place];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative flex flex-col overflow-hidden rounded-3xl border p-5 shadow-md ${styles.ring} ${styles.order}`}
    >
      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${styles.badge}`}>
          {styles.icon}
          {styles.label}
        </span>
        <span className="display text-3xl text-primary">#{place}</span>
      </div>

      <div className="mt-4 flex items-center gap-3">
        {s.team.crest ? (
          <img
            src={s.team.crest}
            alt=""
            className="h-8 w-12 shrink-0 rounded-[3px] object-cover ring-1 ring-border"
            loading="lazy"
          />
        ) : (
          <span className="h-8 w-12 shrink-0 rounded-[3px] bg-secondary/40" aria-hidden="true" />
        )}
        <div className="min-w-0">
          <p className="display truncate text-xl leading-tight sm:text-2xl">{s.player.name}</p>
          <p className="truncate text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            {s.team.name}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          <p>P {s.played ?? "—"} · Ast {s.assists ?? 0}</p>
        </div>
        <div className="text-right">
          <p className="display text-4xl leading-none text-primary sm:text-5xl">{s.goals}</p>
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Goals</p>
        </div>
      </div>

      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-secondary/40" aria-hidden="true">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.max(6, (s.goals / maxGoals) * 100)}%` }}
        />
      </div>
    </motion.div>
  );
}
