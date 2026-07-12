import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
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

type ViewMode = "all" | "knockout";

/**
 * Fixtures page — full match list (default) and knockout bracket view. All
 * data is sourced from the bundled FIFA World Cup 2026 workbook (see
 * `src/data/wc26-matches.json`), never from live APIs.
 */
export default function Fixtures() {
  const [params, setParams] = useSearchParams();
  const view: ViewMode = params.get("view") === "knockout" ? "knockout" : "all";

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

      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="display text-3xl sm:text-4xl md:text-5xl">{view === "knockout" ? "Knockout" : "Fixtures"}</h1>
        <div
          role="tablist"
          aria-label="Fixtures view"
          className="inline-flex rounded-full border border-border bg-card/60 p-1 text-xs font-bold uppercase tracking-[0.2em]"
        >
          {(["all", "knockout"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`rounded-full px-4 py-2 transition-colors ${
                view === v ? "bg-primary text-primary-foreground shadow" : "text-foreground/70 hover:text-foreground"
              }`}
            >
              {v === "all" ? "All Matches" : "Knockout"}
            </button>
          ))}
        </div>
      </div>

      {view === "all" ? <AllMatchesView matches={sorted} /> : <KnockoutView matches={sorted} />}
    </motion.div>
  );
}

/** Prefer full country name from FIFA code; fall back to the raw name in the
 * workbook (used for knockout placeholders like "Winner SF1"). */
function displayName(code: string | null, fallback: string): string {
  return countryName(code) || fallback || "TBD";
}

/**
 * Full fixture list grouped by calendar date (Asia/Dhaka, GMT+6).
 */
function AllMatchesView({ matches }: { matches: Wc26Match[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, Wc26Match[]>();
    for (const m of matches) {
      const key = (m.date_utc ?? "").slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [matches]);

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
      const y = el.getBoundingClientRect().top + window.scrollY - 96;
      window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
    });
  }, [focusKey]);

  if (matches.length === 0) return null;

  return (
    <div className="mt-8 flex flex-col gap-8">
      {groups.map(([day, list]) => (
        <section key={day} ref={(el) => { dayRefs.current[day] = el; }}>
          <h2 className="display sticky top-16 z-10 -mx-4 mb-3 border-y border-border/60 bg-background/85 px-4 py-2 text-sm uppercase tracking-[0.25em] text-primary backdrop-blur">
            {bdShortDate(day + "T00:00:00Z")}
          </h2>
          <ul className="flex flex-col gap-2">
            {list.map((m, i) => {
              const homeName = displayName(m.home_code, m.home_name);
              const awayName = displayName(m.away_code, m.away_name);
              const stageLabel = KO_LABEL[m.stage] ?? (m.stage === "GROUP" ? "Group" : m.stage_label);
              return (
                <motion.li
                  key={m.match_no}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.2) }}
                >
                  <Link
                    to={`/match/${m.match_no}`}
                    className="flex cursor-pointer flex-col gap-2 rounded-lg border border-border bg-card/70 px-4 py-3 shadow-sm transition-colors hover:border-primary"
                  >
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
                      <div className="flex items-center gap-1.5 sm:gap-2 justify-end min-w-0">
                        <span className="display truncate text-right text-sm sm:text-base md:text-lg" title={homeName}>
                          {homeName}
                        </span>
                        {flagUrl(m.home_code, 40) ? (
                          <img src={flagUrl(m.home_code, 40)!} alt={m.home_code ?? ""} className="h-4 w-6 shrink-0 rounded-[2px] object-cover ring-1 ring-border" loading="lazy" />
                        ) : (
                          <span className="h-4 w-6 shrink-0 rounded-[2px] bg-secondary/40" />
                        )}
                      </div>
                      <div className="flex min-w-[72px] sm:min-w-[92px] flex-col items-center gap-0.5">
                        {(m.home_score != null || m.away_score != null) ? (
                          <span className="display text-xl sm:text-2xl tabular-nums text-primary">
                            {m.home_score ?? "–"} : {m.away_score ?? "–"}
                          </span>
                        ) : (
                          <span className="display text-xs sm:text-sm tabular-nums text-foreground/80">{m.date_utc ? bdTime(m.date_utc) : "TBD"}</span>
                        )}
                        <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                          {stageLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 justify-start min-w-0">
                        {flagUrl(m.away_code, 40) ? (
                          <img src={flagUrl(m.away_code, 40)!} alt={m.away_code ?? ""} className="h-4 w-6 shrink-0 rounded-[2px] object-cover ring-1 ring-border" loading="lazy" />
                        ) : (
                          <span className="h-4 w-6 shrink-0 rounded-[2px] bg-secondary/40" />
                        )}
                        <span className="display truncate text-sm sm:text-base md:text-lg" title={awayName}>
                          {awayName}
                        </span>
                      </div>
                    </div>

                    {m.venue_name && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3 w-3" aria-hidden="true" />
                          {m.venue_name}{m.venue_city ? ` · ${m.venue_city}` : ""}
                        </span>
                      </div>
                    )}
                  </Link>
                </motion.li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * Horizontal knockout bracket.
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
    <div className="relative mt-6">
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
              <div key={stage} className="flex min-w-[200px] flex-col md:min-w-[240px]">
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
    <div className="rounded-lg border border-dashed border-border bg-card/20 px-3 py-4 text-center text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
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
        className="block cursor-pointer rounded-lg border border-border bg-card/70 p-3 text-sm shadow-md transition-colors hover:border-primary"
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
