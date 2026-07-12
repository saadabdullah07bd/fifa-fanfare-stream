import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/lib/seo";
import { flagUrl, bdShortDate, bdTime } from "@/lib/flags";
import { normalizeAppMatchStatus } from "@/lib/match-status";

const KO_STAGES = ["SEMI_FINALS", "FINAL"] as const;
const KO_LEGACY: Record<string, string> = {
  "semi-finals": "SEMI_FINALS",
  "final": "FINAL",
};
const KO_LABEL: Record<string, string> = {
  SEMI_FINALS: "Semi-finals",
  FINAL: "Final",
};

export default function Fixtures() {
  const { data = [] } = useQuery({
    queryKey: ["matches"],
    refetchInterval: 60_000,
    queryFn: async () => (await supabase.from("matches").select("*").order("date_utc")).data ?? [],
  });

  const sorted = useMemo(() => [...data].sort((a, b) => a.date_utc.localeCompare(b.date_utc)), [data]);

  const bracketScrollRef = useRef<HTMLDivElement | null>(null);
  const [bracketHasOverflow, setBracketHasOverflow] = useState(false);

  const ko = KO_STAGES.map((stage) => ({
    stage,
    matches: sorted.filter((m) => {
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
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
      className="mx-auto max-w-6xl px-4 py-8"
    >
      <Seo title="Knockout — Pitch26" description="2026 FIFA World Cup knockout bracket." />
      <h1 className="display text-5xl">Knockout</h1>

      {sorted.length === 0 && (
        <p className="mt-8 rounded-lg border border-border bg-card/40 p-6 text-sm text-muted-foreground">
          Schedule loading…
        </p>
      )}

      <div className="relative mt-6">
        <div
          ref={bracketScrollRef}
          className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex justify-center"
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
                        to={`/match/${m.id}`}
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
    </motion.div>
  );
}

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
