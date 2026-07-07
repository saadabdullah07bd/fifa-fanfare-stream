import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/lib/seo";
import { flagUrl, bdDate, bdTime, bdShortDate } from "@/lib/flags";

const KO_STAGES = ["LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "THIRD_PLACE", "FINAL"] as const;
const KO_LEGACY: Record<string, string> = {
  "last-16": "LAST_16",
  "quarter-finals": "QUARTER_FINALS",
  "semi-finals": "SEMI_FINALS",
  "third-place": "THIRD_PLACE",
  "final": "FINAL",
};
const KO_LABEL: Record<string, string> = {
  LAST_16: "Round of 16",
  QUARTER_FINALS: "Quarter-finals",
  SEMI_FINALS: "Semi-finals",
  THIRD_PLACE: "Third place",
  FINAL: "Final",
};

type View = "list" | "focus" | "bracket";

export default function Fixtures() {
  const [view, setView] = useState<View>("list");
  const { data = [] } = useQuery({
    queryKey: ["matches"],
    refetchInterval: 60_000,
    queryFn: async () => (await supabase.from("matches").select("*").order("date_utc")).data ?? [],
  });

  const sorted = useMemo(() => [...data].sort((a, b) => a.date_utc.localeCompare(b.date_utc)), [data]);
  const nextIdx = useMemo(() => {
    const now = Date.now();
    const i = sorted.findIndex((m) => new Date(m.date_utc).getTime() >= now);
    return i === -1 ? Math.max(0, sorted.length - 1) : i;
  }, [sorted]);

  const cardRefs = useRef<Array<HTMLElement | null>>([]);
  useEffect(() => {
    if (view !== "focus" || !sorted.length) return;
    cardRefs.current[nextIdx]?.scrollIntoView({ block: "start" });
  }, [view, sorted.length, nextIdx]);

  const grouped = useMemo(() => {
    const g: Record<string, typeof sorted> = {};
    for (const m of sorted) {
      const d = bdDate(m.date_utc);
      (g[d] ||= []).push(m);
    }
    return Object.entries(g);
  }, [sorted]);

  const ko = KO_STAGES.map((stage) => ({
    stage,
    matches: sorted.filter((m) => {
      const s = (m.stage ?? "").toString();
      return s === stage || KO_LEGACY[s] === stage;
    }),
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
      className="mx-auto max-w-6xl px-4 py-8"
    >
      <Seo title="Fixtures — Pitch26" description="Every 2026 FIFA World Cup fixture and knockout bracket." />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-5xl">Fixtures</h1>
          <p className="mt-1 text-sm text-muted-foreground">Times in Bangladesh (GMT+6, 12h)</p>
        </div>
        <div className="inline-flex rounded-md border border-border bg-card/40 p-1 text-xs uppercase tracking-[0.15em]">
          {(["list", "focus", "bracket"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`relative rounded px-4 py-2 font-bold transition ${view === v ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {view === v && (
                <motion.span layoutId="fx-tab" className="absolute inset-0 rounded bg-primary" transition={{ type: "spring", stiffness: 320, damping: 28 }} />
              )}
              <span className="relative">{v}</span>
            </button>
          ))}
        </div>
      </div>

      {sorted.length === 0 && (
        <p className="mt-8 rounded-lg border border-border bg-card/40 p-6 text-sm text-muted-foreground">
          Schedule not loaded yet. Data auto-refreshes hourly.
        </p>
      )}

      <AnimatePresence mode="wait">
        {view === "list" && (
          <motion.div key="list"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
            className="mt-6 space-y-8"
          >
            {grouped.map(([day, matches]) => (
              <section key={day}>
                <h2 className="display text-xl text-primary">{day}</h2>
                <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-card/40">
                  {matches.map((m, i) => (
                    <motion.li key={m.id}
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                      className="flex items-center gap-4 p-4 hover:bg-card/70 transition-colors"
                    >
                      <span className="w-20 text-sm tabular-nums text-muted-foreground">{bdTime(m.date_utc)}</span>
                      <MiniTeam code={m.home_team_code} align="right" />
                      <span className="display min-w-[60px] text-center text-xl text-primary">
                        {m.status === "scheduled" ? "v" : `${m.home_score ?? 0}–${m.away_score ?? 0}`}
                      </span>
                      <MiniTeam code={m.away_team_code} align="left" />
                      <span className="w-20 text-right text-[11px] uppercase tracking-wider text-muted-foreground">
                        {m.status === "live" ? <><span className="live-dot mr-1 align-middle" />Live</> : m.status}
                      </span>
                    </motion.li>
                  ))}
                </ul>
              </section>
            ))}
          </motion.div>
        )}

        {view === "focus" && (
          <motion.div key="focus"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
            className="mt-6 snap-y snap-mandatory overflow-y-auto rounded-xl border border-border bg-card/20 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ height: "calc(100vh - 240px)" }}
          >
            {sorted.map((m, i) => {
              const isNext = i === nextIdx;
              const upcoming = new Date(m.date_utc).getTime() > Date.now();
              return (
                <article key={m.id}
                  ref={(el) => { cardRefs.current[i] = el; }}
                  className="flex h-full min-h-full snap-start flex-col justify-center p-6"
                  style={{ height: "calc(100vh - 240px)" }}
                >
                  <motion.div
                    initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: false, amount: 0.4 }}
                    transition={{ duration: 0.4 }}
                    className="mx-auto flex w-full max-w-2xl flex-col items-center"
                  >
                    <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-primary">
                      {isNext && upcoming && <span className="rounded-full bg-primary/15 px-2 py-0.5">Next up</span>}
                      {m.status === "live" && <span className="rounded-full bg-accent/20 px-2 py-0.5 text-accent"><span className="live-dot mr-1 align-middle" />Live</span>}
                      <span>{m.stage ?? "Group stage"}</span>
                    </div>
                    <p className="mt-4 text-center text-sm text-muted-foreground">{bdDate(m.date_utc)}</p>
                    <p className="text-center display text-3xl text-primary">{bdTime(m.date_utc)}</p>

                    <div className="mt-8 grid w-full grid-cols-[1fr_auto_1fr] items-center gap-6">
                      <TeamSide code={m.home_team_code} align="right" />
                      <span className="display text-4xl text-muted-foreground">
                        {m.status === "scheduled" ? "vs" : `${m.home_score ?? 0}–${m.away_score ?? 0}`}
                      </span>
                      <TeamSide code={m.away_team_code} align="left" />
                    </div>
                    <p className="mt-8 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
                      Match {i + 1} of {sorted.length}
                    </p>
                  </motion.div>
                </article>
              );
            })}
          </motion.div>
        )}

        {view === "bracket" && (
          <motion.div key="bracket"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
            className="mt-6 overflow-x-auto"
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
                        className="rounded-lg border border-border bg-card/70 p-3 text-sm shadow-md hover:border-primary transition-colors"
                      >
                        <BracketRow code={m.home_team_code} score={m.home_score} />
                        <div className="my-1 h-px bg-border/60" />
                        <BracketRow code={m.away_team_code} score={m.away_score} />
                        <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                          {bdShortDate(m.date_utc)} · {bdTime(m.date_utc)}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Bracket populates as knockout matches are confirmed.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function TeamSide({ code, align }: { code: string | null; align: "left" | "right" }) {
  const url = flagUrl(code, 160);
  return (
    <div className={`flex flex-col items-center ${align === "right" ? "md:items-end" : "md:items-start"}`}>
      {url ? (
        <motion.img whileHover={{ scale: 1.05 }} transition={{ type: "spring", stiffness: 260 }}
          src={url} alt={code ?? "TBD"} loading="lazy"
          className="h-16 w-24 rounded-sm object-cover shadow-md ring-1 ring-border" />
      ) : (
        <div className="grid h-16 w-24 place-items-center rounded-sm bg-card/60 text-xs text-muted-foreground">TBD</div>
      )}
      <span className="mt-3 display text-2xl">{code ?? "TBD"}</span>
    </div>
  );
}

function MiniTeam({ code, align }: { code: string | null; align: "left" | "right" }) {
  const url = flagUrl(code, 40);
  return (
    <span className={`flex flex-1 items-center gap-2 ${align === "right" ? "justify-end" : ""}`}>
      {align === "left" && (url ? <img src={url} alt="" className="h-4 w-6 rounded-[2px] object-cover ring-1 ring-border" loading="lazy" /> : <span className="h-4 w-6 rounded-[2px] bg-secondary/40" />)}
      <span className="display text-xl">{code ?? "TBD"}</span>
      {align === "right" && (url ? <img src={url} alt="" className="h-4 w-6 rounded-[2px] object-cover ring-1 ring-border" loading="lazy" /> : <span className="h-4 w-6 rounded-[2px] bg-secondary/40" />)}
    </span>
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
