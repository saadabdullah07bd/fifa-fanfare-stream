import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/lib/seo";
import { flagUrl, bdShortDate, bdTime } from "@/lib/flags";
import { normalizeAppMatchStatus } from "@/lib/match-status";

// Knockout stages, ordered earliest → latest.
const KO_STAGES = ["LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "THIRD_PLACE", "FINAL"] as const;
const KO_LEGACY: Record<string, string> = {
  "last-32": "LAST_32",
  "last-16": "LAST_16",
  "quarter-finals": "QUARTER_FINALS",
  "semi-finals": "SEMI_FINALS",
  "third-place": "THIRD_PLACE",
  "final": "FINAL",
};
const KO_LABEL: Record<string, string> = {
  LAST_32: "Round of 32",
  LAST_16: "Round of 16",
  QUARTER_FINALS: "Quarter-finals",
  SEMI_FINALS: "Semi-finals",
  THIRD_PLACE: "Third Place",
  FINAL: "Final",
};

type ViewMode = "all" | "knockout";

/**
 * Fixtures page. Two views: full match list (default) and knockout bracket.
 */
export default function Fixtures() {
  const [params, setParams] = useSearchParams();
  const view: ViewMode = params.get("view") === "knockout" ? "knockout" : "all";

  const { data = [] } = useQuery({
    queryKey: ["matches"],
    refetchInterval: 60_000,
    queryFn: async () => (await supabase.from("matches").select("*").order("date_utc")).data ?? [],
  });

  const sorted = useMemo(() => [...data].sort((a, b) => a.date_utc.localeCompare(b.date_utc)), [data]);

  const setView = (v: ViewMode) => {
    const next = new URLSearchParams(params);
    if (v === "all") next.delete("view"); else next.set("view", v);
    setParams(next, { replace: true });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
      className="mx-auto max-w-6xl px-4 py-8"
    >
      <Seo
        title={view === "knockout"
          ? "FIFA World Cup 2026 Knockout Bracket & Kickoff Times | Pitch26"
          : "FIFA World Cup 2026 Fixtures & Kickoff Times | Pitch26"}
        description="Full FIFA World Cup 2026 fixtures list, knockout bracket, quarter-final, semifinal and final schedule with kickoff times, venues and live scores."
        path="/fixtures"
      />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="display text-5xl">{view === "knockout" ? "Knockout" : "Fixtures"}</h1>
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

      {sorted.length === 0 && (
        <p className="mt-8 rounded-lg border border-border bg-card/40 p-6 text-sm text-muted-foreground">
          Schedule loading…
        </p>
      )}

      {view === "all" ? <AllMatchesView matches={sorted} /> : <KnockoutView matches={sorted} />}
    </motion.div>
  );
}

/**
 * Full fixture list grouped by calendar date, from first kickoff to the final.
 */
function AllMatchesView({ matches }: { matches: any[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const m of matches) {
      const key = (m.date_utc ?? "").slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [matches]);

  if (matches.length === 0) return null;

  return (
    <div className="mt-8 flex flex-col gap-8">
      {groups.map(([day, list]) => (
        <section key={day}>
          <h2 className="display sticky top-16 z-10 -mx-4 mb-3 border-y border-border/60 bg-background/85 px-4 py-2 text-sm uppercase tracking-[0.25em] text-primary backdrop-blur">
            {bdShortDate(day + "T00:00:00Z")}
          </h2>
          <ul className="flex flex-col gap-2">
            {list.map((m, i) => (
              <motion.li
                key={m.id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.2) }}
              >
                <Link
                  to={`/match/${(m.external_id ?? "").replace(/^fd_/, "") || m.id}`}
                  className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-lg border border-border bg-card/70 px-4 py-3 shadow-sm hover:border-primary transition-colors"
                >
                  <TeamLabel code={m.home_team_code} align="right" />
                  <div className="flex flex-col items-center gap-0.5 min-w-[92px]">
                    {(m.home_score != null || m.away_score != null) ? (
                      <span className="display text-2xl tabular-nums text-primary">
                        {m.home_score ?? "–"} : {m.away_score ?? "–"}
                      </span>
                    ) : (
                      <span className="display text-sm tabular-nums text-foreground/80">{bdTime(m.date_utc)}</span>
                    )}
                    <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      {normalizeAppMatchStatus(m.status) === "live"
                        ? <><span className="live-dot mr-1 align-middle" />Live</>
                        : (KO_LABEL[KO_LEGACY[(m.stage ?? "").toString()] ?? ""] ?? "Group")}
                    </span>
                  </div>
                  <TeamLabel code={m.away_team_code} align="left" />
                </Link>
              </motion.li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * Team row inside the fixtures list.
 */
function TeamLabel({ code, align }: { code: string | null; align: "left" | "right" }) {
  const url = flagUrl(code, 40);
  return (
    <div className={`flex items-center gap-2 ${align === "right" ? "justify-end flex-row-reverse" : ""}`}>
      {url ? (
        <img src={url} alt={code ?? ""} className="h-4 w-6 rounded-[2px] object-cover ring-1 ring-border" loading="lazy" />
      ) : (
        <span className="h-4 w-6 rounded-[2px] bg-secondary/40" />
      )}
      <span className="display text-lg">{code ?? "TBD"}</span>
    </div>
  );
}

/**
 * Knockout bracket view — Round of 32 through the Final.
 */
function KnockoutView({ matches }: { matches: any[] }) {
  const bracketScrollRef = useRef<HTMLDivElement | null>(null);
  const [bracketHasOverflow, setBracketHasOverflow] = useState(false);

  const ko = KO_STAGES.map((stage) => ({
    stage,
    matches: matches.filter((m) => {
      const s = (m.stage ?? "").toString();
      return s === stage || KO_LEGACY[s] === stage;
    }),
  }));

  useEffect(() => {
    const el = bracketScrollRef.current;
    if (!el) return;
    const check = () => setBracketHasOverflow(el.scrollWidth - el.clientWidth - el.scrollLeft > 8);
    check();
    el.addEventListener("scroll", check);
    window.addEventListener("resize", check);
    return () => { el.removeEventListener("scroll", check); window.removeEventListener("resize", check); };
  }, [ko.length]);

  return (
    <div className="relative mt-6">
      <div
        ref={bracketScrollRef}
        className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex min-w-max gap-6 pb-4">
          {ko.map(({ stage, matches }) => (
            <div key={stage} className="flex min-w-[240px] flex-col gap-4">
              <h3 className="display text-center text-sm uppercase tracking-[0.2em] text-primary">{KO_LABEL[stage]}</h3>
              <div className="flex flex-1 flex-col justify-around gap-4">
                {matches.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border bg-card/20 p-4 text-center text-xs text-muted-foreground">TBD</div>
                )}
                {matches.map((m, i) => (
                  <motion.div key={m.id}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                    whileHover={{ y: -3 }}
                  >
                    <Link
                      to={`/match/${(m.external_id ?? "").replace(/^fd_/, "") || m.id}`}
                      className="block rounded-lg border border-border bg-card/70 p-3 text-sm shadow-md hover:border-primary transition-colors"
                    >
                      <BracketRow code={m.home_team_code} score={m.home_score} />
                      <div className="my-1 h-px bg-border/60" />
                      <BracketRow code={m.away_team_code} score={m.away_score} />
                      <p className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        <span>{bdShortDate(m.date_utc)} · {bdTime(m.date_utc)}</span>
                        <span>
                          {normalizeAppMatchStatus(m.status) === "live"
                            ? <><span className="live-dot mr-1 align-middle" />Live</>
                            : normalizeAppMatchStatus(m.status)}
                        </span>
                      </p>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <AnimatePresence>
        {bracketHasOverflow && (
          <motion.button
            type="button"
            onClick={() => bracketScrollRef.current?.scrollBy({ left: 300, behavior: "smooth" })}
            initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
            className="pointer-events-auto absolute right-2 top-1/2 -translate-y-1/2 grid h-10 w-10 place-items-center rounded-full border border-primary/40 bg-background/90 text-primary shadow-lg backdrop-blur hover:bg-primary hover:text-primary-foreground transition"
            aria-label="Scroll bracket right"
          >
            <ChevronRight className="h-5 w-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Individual team row within the knockout bracket.
 */
function BracketRow({ code, score }: { code: string | null; score: number | null }) {
  const url = flagUrl(code, 40);
  return (
    <div className="flex items-center gap-2">
      {url ? (
        <img src={url} alt={code ?? ""} className="h-4 w-6 rounded-[2px] object-cover ring-1 ring-border" loading="lazy" />
      ) : (
        <span className="h-4 w-6 rounded-[2px] bg-secondary/40" />
      )}
      <span className="display flex-1 text-lg">{code ?? "TBD"}</span>
      <span className="display text-primary tabular-nums">{score ?? "–"}</span>
    </div>
  );
}
