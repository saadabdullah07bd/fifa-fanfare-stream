import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Seo } from "@/lib/seo";
import { bdTime, bdDate, countryName } from "@/lib/flags";

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

/**
 * Formats the match status label for display.
 */

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
/**
 * Detailed view for a specific match, including live score, stats, and timeline.
 */

  const m = v.match(/[\d.]+/);
  return m ? Number(m[0]) : 0;
}

export default function MatchDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  // Prefer going back in history so users return to the fixtures/knockout tab
  // they came from. Fall back to home when there's no previous entry.
  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  };

  const { data: m, isLoading } = useQuery({
    // Fetch core match information (teams, score, timeline).
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
    // Fetch advanced match statistics (possession, shots, etc.).
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
  const isPlaying = ["IN_PLAY", "LIVE"].includes(m.status);
  const homeName = countryName(m.home.tla) || m.home.name;
  const awayName = countryName(m.away.tla) || m.away.name;


  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
      className="mx-auto max-w-4xl px-3 py-6 sm:px-4 sm:py-10"
    >
      <Seo
        title={`${m.home.name} vs ${m.away.name} — Live | Pitch26`}
        description={`${m.competition} · ${m.home.name} vs ${m.away.name} live score, stats and timeline on Pitch26, the 2026 FIFA World Cup fan hub.`}
        path={`/match/${m.id}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "SportsEvent",
          name: `${m.home.name} vs ${m.away.name}`,
          startDate: m.utc_date,
          sport: "Association football",
          competitor: [
            { "@type": "SportsTeam", name: m.home.name },
            { "@type": "SportsTeam", name: m.away.name },
          ],
        }}
      />
      <h1 className="sr-only">{m.home.name} vs {m.away.name} — {m.competition}</h1>
      <button type="button" onClick={goBack} className="text-xs uppercase tracking-[0.2em] text-primary hover:underline">← Back</button>


      <motion.div
        layout
        className={`mt-4 relative overflow-hidden rounded-2xl border border-border bg-card/85 p-4 sm:p-6 shadow-2xl ${isLive ? "live-shimmer" : ""}`}
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
            {isPlaying ? (
              <LiveClock minute={m.minute ?? 0} injury={m.injury_time} />
            ) : (
              <AnimatePresence mode="wait">
                <motion.span key={statusText} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}>
                  {statusText}
                </motion.span>
              </AnimatePresence>
            )}
          </span>
          <span>{m.competition}</span>
        </div>

        <div className="relative mt-6 grid grid-cols-3 items-center gap-2 sm:gap-4">
          <Link to={`/team/${encodeURIComponent(m.home.name)}`} className="group flex flex-col items-end gap-2 text-right min-w-0">
            {m.home.crest && (
              <motion.img whileHover={{ scale: 1.08, rotate: -3 }} transition={{ type: "spring", stiffness: 260 }}
                src={m.home.crest} alt={homeName} className="h-10 w-10 sm:h-14 sm:w-14 md:h-16 md:w-16 object-contain drop-shadow" />
            )}
            <p className="display w-full truncate text-base sm:text-2xl md:text-3xl group-hover:text-primary transition-colors" title={homeName}>{homeName}</p>
          </Link>
          <div className="text-center">
            <AnimatePresence mode="popLayout">
              <motion.p
                key={`${m.score.full.home}-${m.score.full.away}`}
                initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.15, opacity: 0 }}
                transition={{ type: "spring", stiffness: 220, damping: 18 }}
                className="display text-4xl sm:text-6xl md:text-7xl text-primary tabular-nums whitespace-nowrap"
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
          <Link to={`/team/${encodeURIComponent(m.away.name)}`} className="group flex flex-col items-start gap-2 text-left min-w-0">
            {m.away.crest && (
              <motion.img whileHover={{ scale: 1.08, rotate: 3 }} transition={{ type: "spring", stiffness: 260 }}
                src={m.away.crest} alt={awayName} className="h-10 w-10 sm:h-14 sm:w-14 md:h-16 md:w-16 object-contain drop-shadow" />
            )}
            <p className="display w-full truncate text-base sm:text-2xl md:text-3xl group-hover:text-primary transition-colors" title={awayName}>{awayName}</p>
          </Link>
        </div>
        {m.venue && (
          <p className="relative mt-4 text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {m.venue}
          </p>
        )}
      </motion.div>

      {/* Goals */}
      <section className="mt-10">
        <h2 className="display text-2xl text-primary">Goals</h2>
        {m.goals.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No goals yet.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {m.goals.map((g, i) => (
                <motion.li
                  key={`${g.minute}-${g.scorer}-${i}`}
                  layout
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.2) }}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/50 p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-primary bg-background text-sm">⚽</span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {g.scorer}
                        {g.assist && <span className="ml-1 text-xs font-normal text-muted-foreground">· assist {g.assist}</span>}
                      </p>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        {countryName(g.team_tla) || g.team_name}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {g.score && (
                      <span className="display text-primary tabular-nums">{g.score.home}–{g.score.away}</span>
                    )}
                    <span className="display text-sm tabular-nums text-primary">
                      {g.minute}{g.injury_time ? `+${g.injury_time}` : ""}'
                    </span>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>


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
            
          </div>
        )}
      </section>

    </motion.div>
  );
}

/**
 * Real-time clock component that increments every second.
 */


// Live minute:seconds ticker. Anchors on the fetched `minute` and ticks forward
// in real time so users see the clock move between refetches.
function LiveClock({ minute, injury }: { minute: number; injury: number | null }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    setSeconds(0);
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [minute, injury]);

  const totalSec = seconds;
  const extraMin = Math.floor(totalSec / 60);
  const s = String(totalSec % 60).padStart(2, "0");
  const shown = minute + extraMin;
  return (
    <motion.span
      key={`${minute}-${extraMin}-${s}`}
      initial={{ opacity: 0.6 }} animate={{ opacity: 1 }}
      className="tabular-nums"
    >
      {shown}{injury ? `+${injury}` : ""}:{s}'
    </motion.span>
  );
}
