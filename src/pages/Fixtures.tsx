import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, MapPin, Trophy, CircleDot } from "lucide-react";
import { Seo } from "@/lib/seo";
import { flagUrl, countryName, bdShortDate, bdTime } from "@/lib/flags";
import { WC26_MATCHES, type Wc26Match } from "@/data/wc26-matches";


// Knockout stages ordered earliest → latest. Third-place playoff intentionally
// omitted so the bracket squeezes cleanly from Round of 32 into the Final.
const KO_STAGES = ["LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL"] as const;
const KO_LABEL: Record<string, string> = {
  LAST_32: "Round of 32",
  LAST_16: "Round of 16",
  QUARTER_FINALS: "Quarter-finals",
  SEMI_FINALS: "Semi-finals",
  FINAL: "Final",
};

// Stage filter chips available in the "All Matches" view.
type StageFilter = "ALL" | "GROUP" | "LAST_32" | "LAST_16" | "QUARTER_FINALS" | "SEMI_FINALS" | "FINAL" | "THIRD_PLACE";
const STAGE_CHIPS: { id: StageFilter; label: string }[] = [
  { id: "ALL", label: "All Stages" },
  { id: "GROUP", label: "Group Stage" },
  { id: "LAST_32", label: "Round of 32" },
  { id: "LAST_16", label: "Round of 16" },
  { id: "QUARTER_FINALS", label: "Quarter Finals" },
  { id: "SEMI_FINALS", label: "Semi Finals" },
  { id: "THIRD_PLACE", label: "3rd Place" },
  { id: "FINAL", label: "Final" },
];

type ViewMode = "all" | "knockout";

/**
 * Fixtures page — full match list (default) and knockout bracket view. All
 * data is sourced from the bundled FIFA World Cup 2026 workbook (see
 * `src/data/wc26-matches.json`), never from live APIs.
 */
export default function Fixtures() {
  const [params, setParams] = useSearchParams();
  const view: ViewMode = params.get("view") === "knockout" ? "knockout" : "all";
  const stageParam = (params.get("stage") ?? "ALL") as StageFilter;
  const stage: StageFilter = STAGE_CHIPS.some((c) => c.id === stageParam) ? stageParam : "ALL";

  const sorted = useMemo(
    () => [...WC26_MATCHES]
      .filter((m) => m.date_utc)
      .sort((a, b) => (a.date_utc ?? "").localeCompare(b.date_utc ?? "")),
    [],
  );

  const setView = (v: ViewMode) => {
    const next = new URLSearchParams(params);
    if (v === "all") next.delete("view");
    else next.set("view", v);
    setParams(next, { replace: true });
  };

  const setStage = (s: StageFilter) => {
    const next = new URLSearchParams(params);
    if (s === "ALL") next.delete("stage");
    else next.set("stage", s);
    setParams(next, { replace: true });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
      className="mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-8"
    >
      <Seo
        title={view === "knockout"
          ? "FIFA World Cup 2026 Knockout Bracket & Kickoff Times | Pitch26"
          : "FIFA World Cup 2026 Fixtures & Kickoff Times | Pitch26"}
        description="Full FIFA World Cup 2026 fixtures list, knockout bracket, quarter-final, semifinal and final schedule with kickoff times, stadiums and live scores."
        path="/fixtures"
      />

      {/* ─────────── Header + view toggle ─────────── */}
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <h1 className="display text-5xl leading-none tracking-tight sm:text-6xl md:text-7xl">
            Match <span className="text-primary">Fixtures</span>
          </h1>
          <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
            World Cup 2026 · Road to the Final
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Fixtures view"
          className="inline-flex rounded-2xl border border-border bg-card p-1 text-xs font-bold uppercase tracking-[0.2em]"
        >
          {(["all", "knockout"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`rounded-xl px-5 py-2 transition-colors ${
                view === v ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v === "all" ? "All Matches" : "Knockouts"}
            </button>
          ))}
        </div>
      </div>

      {/* ─────────── Sticky stage-filter chips (All view only) ─────────── */}
      {view === "all" && (
        <div className="sticky top-16 z-30 -mx-3 mt-8 px-3 sm:-mx-4 sm:px-4">
          <div
            role="tablist"
            aria-label="Filter fixtures by stage"
            className="flex gap-2 overflow-x-auto rounded-3xl border border-border bg-card/85 p-2 backdrop-blur-md [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {STAGE_CHIPS.map((chip) => {
              const active = stage === chip.id;
              return (
                <button
                  key={chip.id}
                  role="tab"
                  aria-selected={active}
                  type="button"
                  onClick={() => setStage(chip.id)}
                  className={`shrink-0 whitespace-nowrap rounded-2xl px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] transition-colors ${
                    active
                      ? "bg-[var(--trophy-green)] text-white shadow"
                      : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {view === "all"
        ? <AllMatchesView matches={sorted} stage={stage} />
        : <KnockoutView matches={sorted} />}
    </motion.div>
  );
}

/** Prefer full country name from FIFA code; fall back to the raw name in the
 * workbook (used for knockout placeholders like "Winner SF1"). */
function displayName(code: string | null, fallback: string): string {
  return countryName(code) || fallback || "TBD";
}

/**
 * Full fixture list grouped by calendar date, with premium broadcast cards.
 */
function AllMatchesView({ matches, stage }: { matches: Wc26Match[]; stage: StageFilter }) {
  const filtered = useMemo(
    () => stage === "ALL" ? matches : matches.filter((m) => m.stage === stage),
    [matches, stage],
  );

  const groups = useMemo(() => {
    const map = new Map<string, Wc26Match[]>();
    for (const m of filtered) {
      const key = (m.date_utc ?? "").slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const focusKey = useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10);
    const upcoming = groups.find(([day]) => day >= todayIso);
    return upcoming?.[0] ?? groups[groups.length - 1]?.[0] ?? null;
  }, [groups]);

  const dayRefs = useRef<Record<string, HTMLElement | null>>({});
  const scrolledRef = useRef(false);

  useEffect(() => {
    if (scrolledRef.current || !focusKey) return;
    const el = dayRefs.current[focusKey];
    if (!el) return;
    scrolledRef.current = true;
    requestAnimationFrame(() => {
      const y = el.getBoundingClientRect().top + window.scrollY - 200;
      window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
    });
  }, [focusKey]);

  if (filtered.length === 0) {
    return (
      <div className="mt-16 rounded-3xl border border-dashed border-border bg-card/40 p-10 text-center">
        <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground">
          No matches in this stage yet.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 flex flex-col gap-10">
      {groups.map(([day, list]) => (
        <section key={day} ref={(el) => { dayRefs.current[day] = el; }}>
          <div className="mb-4 flex items-center gap-4 px-1">
            <h2 className="display text-2xl tracking-wider text-primary sm:text-3xl">
              {bdShortDate(day + "T00:00:00Z")}
            </h2>
            <div className="h-px flex-1 bg-gradient-to-r from-primary/40 to-transparent" />
          </div>
          <ul className="flex flex-col gap-3">
            {list.map((m, i) => (
              <motion.li
                key={m.match_no}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.2) }}
              >
                <FixtureCard match={m} />
              </motion.li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * Premium-broadcast fixture card: home team (right-aligned) · score/time centre
 * · away team (left-aligned), with a venue + stage-chip footer.
 */
function FixtureCard({ match: m }: { match: Wc26Match }) {
  const homeName = displayName(m.home_code, m.home_name);
  const awayName = displayName(m.away_code, m.away_name);
  const stageLabel = KO_LABEL[m.stage] ?? (m.stage === "GROUP" ? "Group Stage" : m.stage_label);
  const played = m.home_score != null && m.away_score != null;
  const homeCrest = flagUrl(m.home_code, 80);
  const awayCrest = flagUrl(m.away_code, 80);

  return (
    <Link
      to={`/match/${m.match_no}`}
      aria-label={`${homeName} vs ${awayName} — ${stageLabel}`}
      className="group relative block overflow-hidden rounded-3xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-card/60 md:p-6"
    >
      <div className="grid grid-cols-1 items-center gap-5 md:grid-cols-[1fr_auto_1fr] md:gap-6">
        {/* Home team */}
        <div className="order-2 flex items-center justify-center gap-3 md:order-1 md:justify-end md:gap-4">
          <span className="display truncate text-lg tracking-tight text-foreground transition-colors group-hover:text-primary sm:text-xl md:text-2xl" title={homeName}>
            {homeName}
          </span>
          {homeCrest ? (
            <img
              src={homeCrest}
              alt=""
              width={48}
              height={48}
              loading="lazy"
              className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-border md:h-12 md:w-12"
            />
          ) : (
            <span className="h-10 w-10 shrink-0 rounded-full bg-secondary md:h-12 md:w-12" />
          )}
        </div>

        {/* Score / Time capsule */}
        <div className="order-1 flex flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-black/40 px-6 py-3 md:order-2 md:px-8">
          {played ? (
            <>
              <span className="display text-2xl tabular-nums tracking-widest sm:text-3xl">
                {m.home_score}
                <span className="mx-2 text-primary">-</span>
                {m.away_score}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Full time
              </span>
            </>
          ) : (
            <>
              <span className="display text-2xl tracking-widest text-primary sm:text-3xl">
                {m.date_utc ? bdTime(m.date_utc) : "TBD"}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Kick-off
              </span>
            </>
          )}
        </div>

        {/* Away team */}
        <div className="order-3 flex items-center justify-center gap-3 md:justify-start md:gap-4">
          {awayCrest ? (
            <img
              src={awayCrest}
              alt=""
              width={48}
              height={48}
              loading="lazy"
              className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-border md:h-12 md:w-12"
            />
          ) : (
            <span className="h-10 w-10 shrink-0 rounded-full bg-secondary md:h-12 md:w-12" />
          )}
          <span className="display truncate text-lg tracking-tight text-foreground transition-colors group-hover:text-primary sm:text-xl md:text-2xl" title={awayName}>
            {awayName}
          </span>
        </div>
      </div>

      {/* Footer: venue + stage chip */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
        {m.venue_name ? (
          <p className="inline-flex min-w-0 items-center gap-1.5 truncate text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {m.venue_name}{m.venue_city ? ` · ${m.venue_city}` : ""}
            </span>
          </p>
        ) : <span />}
        <span
          className={`rounded-lg px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] ${
            m.stage === "GROUP"
              ? "bg-secondary text-muted-foreground"
              : "bg-[var(--trophy-green)] text-white"
          }`}
        >
          {stageLabel}
        </span>
      </div>
    </Link>
  );
}

/**
 * Horizontal knockout bracket. Structure preserved from the previous design.
 */
function KnockoutView({ matches }: { matches: Wc26Match[] }) {
  const rounds = KO_STAGES.map((stage, i) => {
    const slots = Math.max(1, 16 / Math.pow(2, i));
    const found = matches.filter((m) => m.stage === stage);
    const filled: (Wc26Match | null)[] = [];
    for (let j = 0; j < slots; j++) filled.push(found[j] ?? null);
    return { stage, slots, items: filled };
  });

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => {
      setCanLeft(el.scrollLeft > 8);
      setCanRight(el.scrollWidth - el.clientWidth - el.scrollLeft > 8);
    };
    check();
    el.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      el.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [rounds.length]);

  const scrollBy = (dir: 1 | -1) =>
    scrollRef.current?.scrollBy({ left: dir * 360, behavior: "smooth" });

  return (
    <div className="relative mt-8">
      <div
        ref={scrollRef}
        className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex min-w-max items-stretch gap-3 pb-4 md:gap-6">
          {rounds.map(({ stage, items }, idx) => {
            const isLast = idx === rounds.length - 1;
            const pairs: (Wc26Match | null)[][] = [];
            for (let i = 0; i < items.length; i += 2) {
              pairs.push(items.slice(i, i + 2));
            }
            return (
              <div key={stage} className="flex min-w-[220px] flex-col md:min-w-[260px]">
                <h3 className="display mb-3 text-center text-xs uppercase tracking-[0.24em] text-primary md:text-sm">
                  {KO_LABEL[stage]}
                </h3>
                <div className="flex flex-1 flex-col justify-around gap-4">
                  {pairs.map((pair, pi) => (
                    <BracketPair key={pi} isLast={isLast} single={pair.length === 1}>
                      {pair.map((m, ii) =>
                        m ? (
                          <BracketCard key={m.match_no} match={m} index={pi * 2 + ii} />
                        ) : (
                          <BracketPlaceholder key={ii} />
                        ),
                      )}
                    </BracketPair>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {canLeft && (
          <motion.button
            key="left"
            type="button"
            onClick={() => scrollBy(-1)}
            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
            className="pointer-events-auto absolute left-2 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-primary/40 bg-background/90 text-primary shadow-lg backdrop-blur transition hover:bg-primary hover:text-primary-foreground md:grid"
            aria-label="Scroll bracket left"
          >
            <ChevronLeft className="h-5 w-5" />
          </motion.button>
        )}
        {canRight && (
          <motion.button
            key="right"
            type="button"
            onClick={() => scrollBy(1)}
            initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
            className="pointer-events-auto absolute right-2 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-primary/40 bg-background/90 text-primary shadow-lg backdrop-blur transition hover:bg-primary hover:text-primary-foreground md:grid"
            aria-label="Scroll bracket right"
          >
            <ChevronRight className="h-5 w-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function BracketPair({
  children,
  isLast,
  single,
}: {
  children: React.ReactNode;
  isLast: boolean;
  single: boolean;
}) {
  return (
    <div className="relative flex flex-col justify-around gap-3">
      {children}
      {!isLast && !single && (
        <span
          aria-hidden
          className="pointer-events-none absolute -right-3 top-[25%] bottom-[25%] w-3 md:-right-6 md:w-6"
        >
          <span className="absolute left-0 top-0 h-px w-1/2 bg-border" />
          <span className="absolute left-0 bottom-0 h-px w-1/2 bg-border" />
          <span className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-border" />
          <span className="absolute left-1/2 top-1/2 h-px w-1/2 -translate-y-1/2 bg-border" />
        </span>
      )}
      {!isLast && single && (
        <span
          aria-hidden
          className="pointer-events-none absolute -right-3 top-1/2 h-px w-3 -translate-y-1/2 bg-border md:-right-6 md:w-6"
        />
      )}
    </div>
  );
}

function BracketPlaceholder() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/20 px-3 py-5 text-center text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
      TBD
    </div>
  );
}

function BracketCard({ match, index }: { match: Wc26Match; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.2) }}
      whileHover={{ y: -2 }}
    >
      <Link
        to={`/match/${match.match_no}`}
        className="block cursor-pointer rounded-2xl border border-border bg-card p-3 text-sm shadow-md transition-colors hover:border-primary"
      >
        <BracketRow code={match.home_code} fallback={match.home_name} score={match.home_score} />
        <div className="my-1 h-px bg-border/60" />
        <BracketRow code={match.away_code} fallback={match.away_name} score={match.away_score} />
        <p className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <span>{match.date_utc ? `${bdShortDate(match.date_utc)} · ${bdTime(match.date_utc)}` : "TBD"}</span>
        </p>
        {match.venue_name && (
          <p className="mt-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <MapPin className="h-3 w-3" aria-hidden="true" />
            <span className="truncate">{match.venue_name}{match.venue_city ? ` · ${match.venue_city}` : ""}</span>
          </p>
        )}
      </Link>
    </motion.div>
  );
}

function BracketRow({ code, fallback, score }: { code: string | null; fallback: string; score: number | null }) {
  const url = flagUrl(code, 40);
  const name = displayName(code, fallback);
  return (
    <div className="flex items-center gap-2 min-w-0">
      {url ? (
        <img src={url} alt={code ?? ""} className="h-4 w-6 shrink-0 rounded-[2px] object-cover ring-1 ring-border" loading="lazy" />
      ) : (
        <span className="h-4 w-6 shrink-0 rounded-[2px] bg-secondary/40" />
      )}
      <span className="display flex-1 min-w-0 truncate text-sm md:text-base" title={name}>{name}</span>
      <span className="display shrink-0 text-primary tabular-nums">{score ?? "–"}</span>
    </div>
  );
}
