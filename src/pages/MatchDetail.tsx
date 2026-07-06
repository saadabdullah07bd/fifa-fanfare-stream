import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Seo } from "@/lib/seo";
import { bdTime, bdDate } from "@/lib/flags";

type Goal = { minute: number; injury_time: number | null; type: string; team_tla: string; team_name: string; scorer: string; assist: string | null; score: { home: number; away: number } | null };
type Booking = { minute: number; card: string; player: string; team_tla: string };
type MatchDetail = {
  id: number; competition: string; status: string; minute: number | null; injury_time: number | null;
  utc_date: string; venue: string | null; referees: string[];
  home: { name: string; tla: string; crest: string; id: number };
  away: { name: string; tla: string; crest: string; id: number };
  score: { full: { home: number | null; away: number | null }; half: { home: number | null; away: number | null }; winner: string | null };
  goals: Goal[]; bookings: Booking[];
};
type StatItem = { name: string; home: string | number; away: string | number; compareCode: number | null };
type MatchStats = { available: boolean; stats: StatItem[]; status?: string | null };

const FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/match-detail`;
const STATS_FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/match-stats`;

function statusLabel(status: string, minute: number | null, injury: number | null, utcDate: string): { label: string; live: boolean } {
  if (status === "PAUSED") return { label: "Half-time", live: true };
  if (["IN_PLAY", "LIVE"].includes(status)) {
    const m = minute ?? 0;
    return { label: `${m}${injury ? `+${injury}` : ""}'`, live: true };
  }
  if (status === "FINISHED") return { label: "Full time", live: false };
  return { label: `${bdDate(utcDate)} · ${bdTime(utcDate)}`, live: false };
}

function toNum(v: string | number): number {
  if (typeof v === "number") return v;
  const m = v.match(/[\d.]+/);
  return m ? Number(m[0]) : 0;
}

export default function MatchDetail() {
  const { id } = useParams();

  const { data: m, isLoading } = useQuery({
    queryKey: ["match-detail", id],
    enabled: !!id,
    refetchInterval: 30_000,
    queryFn: async () => {
      const res = await fetch(`${FN}?id=${id}`, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } });
      if (!res.ok) throw new Error("match load failed");
      return res.json() as Promise<MatchDetail>;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["match-stats", m?.home.name, m?.away.name, m?.utc_date],
    enabled: !!m,
    refetchInterval: 45_000,
    queryFn: async () => {
      const params = new URLSearchParams({ home: m!.home.name, away: m!.away.name, date: m!.utc_date });
      const res = await fetch(`${STATS_FN}?${params}`, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } });
      return res.json() as Promise<MatchStats>;
    },
  });

  if (isLoading || !m) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-24 text-center">
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.4, repeat: Infinity }}
          className="text-sm uppercase tracking-[0.3em] text-muted-foreground"
        >Loading match…</motion.div>
      </div>
    );
  }

  const { label: statusText, live: isLive } = statusLabel(m.status, m.minute, m.injury_time, m.utc_date);
  const timeline = [
    ...m.goals.map((g) => ({ kind: "goal" as const, minute: g.minute, injury: g.injury_time, data: g })),
    ...m.bookings.map((b) => ({ kind: "card" as const, minute: b.minute, injury: null, data: b })),
  ].sort((a, b) => a.minute - b.minute);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
      className="mx-auto max-w-4xl px-4 py-10"
    >
      <Seo
        title={`${m.home.name} vs ${m.away.name} — Live | Pitch26`}
        description={`${m.competition} · ${m.home.name} vs ${m.away.name} live score, stats and timeline.`}
        path={`/match/${m.id}`}
      />
      <Link to="/" className="text-xs uppercase tracking-[0.2em] text-primary hover:underline">← Home</Link>

      <motion.div
        layout
        className={`mt-4 relative overflow-hidden rounded-2xl border border-border bg-card/85 p-6 shadow-2xl ${isLive ? "live-shimmer" : ""}`}
      >
        {isLive && (
          <motion.div
            className="pointer-events-none absolute inset-0 -z-0"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ background: "radial-gradient(600px circle at 50% -20%, hsl(var(--primary) / 0.18), transparent 60%)" }}
          />
        )}
        <div className="relative flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <span className="font-bold text-primary">
            {isLive && <span className="live-dot mr-2 align-middle" />}
            <AnimatePresence mode="wait">
              <motion.span key={statusText} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}>
                {statusText}
              </motion.span>
            </AnimatePresence>
          </span>
          <span>{m.competition}</span>
        </div>

        <div className="relative mt-6 grid grid-cols-3 items-center gap-4">
          <Link to={`/team/${encodeURIComponent(m.home.name)}`} className="group flex flex-col items-end gap-2 text-right">
            {m.home.crest && (
              <motion.img whileHover={{ scale: 1.08, rotate: -3 }} transition={{ type: "spring", stiffness: 260 }}
                src={m.home.crest} alt={m.home.name} className="h-16 w-16 object-contain drop-shadow" />
            )}
            <p className="display text-2xl md:text-3xl group-hover:text-primary transition-colors">{m.home.name}</p>
          </Link>
          <div className="text-center">
            <AnimatePresence mode="popLayout">
              <motion.p
                key={`${m.score.full.home}-${m.score.full.away}`}
                initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.15, opacity: 0 }}
                transition={{ type: "spring", stiffness: 220, damping: 18 }}
                className="display text-6xl md:text-7xl text-primary tabular-nums"
              >
                {m.score.full.home ?? "–"} : {m.score.full.away ?? "–"}
              </motion.p>
            </AnimatePresence>
            {m.score.half.home !== null && (
              <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                HT {m.score.half.home}–{m.score.half.away}
              </p>
            )}
          </div>
          <Link to={`/team/${encodeURIComponent(m.away.name)}`} className="group flex flex-col items-start gap-2 text-left">
            {m.away.crest && (
              <motion.img whileHover={{ scale: 1.08, rotate: 3 }} transition={{ type: "spring", stiffness: 260 }}
                src={m.away.crest} alt={m.away.name} className="h-16 w-16 object-contain drop-shadow" />
            )}
            <p className="display text-2xl md:text-3xl group-hover:text-primary transition-colors">{m.away.name}</p>
          </Link>
        </div>
        {(m.venue || m.referees.length > 0) && (
          <p className="relative mt-4 text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {m.venue}{m.venue && m.referees.length > 0 ? " · " : ""}{m.referees.length > 0 && `Ref ${m.referees[0]}`}
          </p>
        )}
      </motion.div>

      {/* Live stats */}
      <section className="mt-10">
        <h2 className="display text-2xl text-primary">Live stats</h2>
        {!stats || stats.stats.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {stats?.available === false ? "Stats not available for this match yet." : "Fetching live stats…"}
          </p>
        ) : (
          <div className="mt-4 grid gap-3 rounded-xl border border-border bg-card/40 p-5">
            {stats.stats.map((s, i) => {
              const h = toNum(s.home); const a = toNum(s.away); const total = h + a || 1;
              const hp = (h / total) * 100; const ap = (a / total) * 100;
              return (
                <motion.div key={s.name + i}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                >
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.15em] text-muted-foreground">
                    <span className="w-14 text-left font-bold text-foreground tabular-nums">{s.home}</span>
                    <span>{s.name}</span>
                    <span className="w-14 text-right font-bold text-foreground tabular-nums">{s.away}</span>
                  </div>
                  <div className="mt-1 flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-secondary/40">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${hp}%` }} transition={{ duration: 0.6, ease: "easeOut" }}
                      className="bg-primary" />
                    <motion.div initial={{ width: 0 }} animate={{ width: `${ap}%` }} transition={{ duration: 0.6, ease: "easeOut" }}
                      className="bg-accent" />
                  </div>
                </motion.div>
              );
            })}
            <p className="mt-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Source: SofaScore · updates every 45s</p>
          </div>
        )}
      </section>

      {/* Timeline */}
      <section className="mt-10">
        <h2 className="display text-2xl text-primary">Timeline</h2>
        {timeline.length === 0 && <p className="mt-3 text-sm text-muted-foreground">No goals or cards yet.</p>}
        <ol className="mt-4 relative border-l-2 border-primary/30 pl-6">
          <AnimatePresence initial={false}>
            {timeline.map((ev, i) => (
              <motion.li
                key={i}
                layout
                initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="relative mb-6"
              >
                <span className="absolute -left-[33px] grid h-6 w-6 place-items-center rounded-full border-2 border-primary bg-background text-xs">
                  {ev.kind === "goal" ? "⚽" : (ev.data as Booking).card?.includes("RED") ? "🟥" : "🟨"}
                </span>
                <div className="rounded-lg border border-border bg-card/50 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-primary">
                    {ev.minute}{ev.injury ? `+${ev.injury}` : ""}' · {ev.kind === "goal" ? (ev.data as Goal).team_name : (ev.data as Booking).team_tla}
                  </p>
                  {ev.kind === "goal" ? (
                    <p className="mt-1 font-semibold">
                      {(ev.data as Goal).scorer}
                      {(ev.data as Goal).assist && <span className="text-sm font-normal text-muted-foreground"> · assist {(ev.data as Goal).assist}</span>}
                      {(ev.data as Goal).score && <span className="display ml-2 text-primary">{(ev.data as Goal).score!.home}–{(ev.data as Goal).score!.away}</span>}
                    </p>
                  ) : (
                    <p className="mt-1 font-semibold">
                      {(ev.data as Booking).player} <span className="text-sm text-muted-foreground">· {(ev.data as Booking).card.replace("_", " ").toLowerCase()}</span>
                    </p>
                  )}
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      </section>
    </motion.div>
  );
}
