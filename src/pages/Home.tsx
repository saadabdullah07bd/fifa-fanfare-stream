import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, PlayCircle, Zap, Trophy, MapPin, Radio, Clock } from "lucide-react";
import { Seo } from "@/lib/seo";
import { useLiveMatches, type LiveMatch } from "@/components/LiveTicker";
import { WC26_MATCHES, findWc26MatchByTeams, type Wc26Match } from "@/data/wc26-matches";
import { bdTime, bdDate, bdShortDate, flagUrl, countryName, bestFifaCode } from "@/lib/flags";
import wc26Emblem from "@/assets/wc26-trophy.png.asset.json";

type Article = {
  id: string;
  title: string;
  url: string;
  source: string;
  summary: string;
  image_url: string | null;
  published_at: string | null;
};

const NEWS_FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/news-feed`;

/**
 * Landing page — bento-grid hub for the FIFA World Cup 2026. Modernized with
 * stronger responsive scaling, improved accessibility, reduced-motion support,
 * skeleton loading states, and a live countdown to the next kick-off.
 */
export default function Home() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const { data: liveData, isLoading: liveLoading } = useLiveMatches();
  const liveMatches = liveData?.matches ?? [];

  const { data: newsData, isLoading: newsLoading } = useQuery({
    queryKey: ["news-feed-home"],
    refetchInterval: 300_000,
    queryFn: async () => {
      const res = await fetch(NEWS_FN, {
        headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      });
      if (!res.ok) throw new Error(`News feed failed (${res.status})`);
      return res.json() as Promise<{ articles: Article[] }>;
    },
  });
  const flashHeadline = newsData?.articles?.[0] ?? null;

  const hero: HeroMatch | null = useMemo(() => {
    const liveNow = liveMatches.find((m) => ["IN_PLAY", "PAUSED", "LIVE"].includes(m.status));
    if (liveNow) return fromLive(liveNow);
    const upcoming = liveMatches.find((m) => m.status === "SCHEDULED" || m.status === "TIMED");
    if (upcoming) return fromLive(upcoming);
    const nowIso = new Date().toISOString();
    const nextWc =
      WC26_MATCHES.filter((m) => m.date_utc && m.home_score == null && m.date_utc >= nowIso).sort(
        (a, b) => (a.date_utc ?? "").localeCompare(b.date_utc ?? ""),
      )[0] ??
      WC26_MATCHES.filter((m) => m.date_utc).sort((a, b) =>
        (b.date_utc ?? "").localeCompare(a.date_utc ?? ""),
      )[0];
    return nextWc ? fromWc(nextWc) : null;
  }, [liveMatches]);

  const topScorer = useMemo(() => {
    const tally = new Map<string, { player: string; goals: number; team: string }>();
    for (const m of WC26_MATCHES) {
      for (const g of m.goals) {
        if (g.type === "OG") continue;
        const key = g.player;
        const prev = tally.get(key);
        const team = g.team ?? m.home_name;
        if (prev) prev.goals += 1;
        else tally.set(key, { player: g.player, goals: 1, team });
      }
    }
    const list = [...tally.values()].sort((a, b) => b.goals - a.goals);
    return list[0] ?? null;
  }, []);

  const recentResults = useMemo(() => {
    return WC26_MATCHES.filter((m) => m.home_score != null && m.away_score != null && m.date_utc)
      .sort((a, b) => (b.date_utc ?? "").localeCompare(a.date_utc ?? ""))
      .slice(0, 3);
  }, []);

  const scoreboard = useMemo(() => {
    const live = liveMatches.filter((m) => ["IN_PLAY", "PAUSED", "LIVE"].includes(m.status));
    // Most recently kicked-off finished match first, so the scoreboard always
    // surfaces the latest result rather than a not-yet-played fixture.
    const finished = liveMatches
      .filter((m) => m.status === "FINISHED")
      .sort((a, b) => (b.utc_date ?? "").localeCompare(a.utc_date ?? ""));
    const upcoming = liveMatches
      .filter((m) => m.status === "SCHEDULED" || m.status === "TIMED")
      .sort((a, b) => (a.utc_date ?? "").localeCompare(b.utc_date ?? ""));
    // Priority: live > latest finished > next upcoming.
    const picked = [...live, ...finished, ...upcoming].slice(0, 2);
    if (picked.length > 0) return picked.map(fromLive);
    // Offline fallback: the two most recently played matches in the dataset.
    return WC26_MATCHES.filter((m) => m.home_score != null && m.date_utc)
      .sort((a, b) => (b.date_utc ?? "").localeCompare(a.date_utc ?? ""))
      .slice(0, 2)
      .map(fromWc);
  }, [liveMatches]);

  const liveCount = liveMatches.filter((m) =>
    ["IN_PLAY", "PAUSED", "LIVE"].includes(m.status),
  ).length;

  const enter = reduceMotion
    ? { initial: false, animate: { opacity: 1, y: 0 } }
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.4 },
      };

  return (
    <div className="mx-auto max-w-7xl px-3 pb-14 pt-4 sm:px-6 sm:pt-6">
      <Seo
        title="Watch FIFA World Cup 2026 Live Free — Semifinals, Final & Every Match | Pitch26"
        description="Watch FIFA World Cup 2026 live free — semifinals, final and every match in HD & 4K. Live scores, fixtures, groups, standings and top scorers, updated by the second."
        path="/"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "Watch FIFA World Cup 2026 Live Free",
          description:
            "Stream every FIFA World Cup 2026 match live and free with live scores and stats.",
          url: "https://pitch26.muhammadsaadabdullah.com/",
        }}
      />

      <h1 className="sr-only">Pitch26 — FIFA World Cup 2026 live scores, fixtures & standings</h1>

      {/* Editorial header */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 sm:mb-6">
        <div className="flex items-center gap-2">
          <span
            role="status"
            aria-live="polite"
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] backdrop-blur-md ${
              liveCount > 0
                ? "border-destructive/40 bg-destructive/15 text-destructive"
                : "border-border bg-card/60 text-muted-foreground"
            }`}
          >
            {liveCount > 0 ? (
              <span className="live-dot" aria-hidden="true" />
            ) : (
              <Radio className="h-3 w-3" aria-hidden="true" />
            )}
            {liveCount > 0 ? `${liveCount} live now` : "No live matches"}
          </span>
          <span className="hidden text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground/70 sm:inline">
            FIFA World Cup 2026
          </span>
        </div>
        <Link
          to="/fixtures"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-foreground/80 transition hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Full schedule <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </header>

      <motion.div
        {...enter}
        className="grid auto-rows-[minmax(150px,auto)] grid-cols-1 gap-3 sm:gap-4 md:grid-cols-12 md:gap-5"
      >
        {hero ? (
          <HeroTile hero={hero} onWatch={() => navigate("/live-tv")} />
        ) : (
          <SkeletonTile
            className="md:col-span-8 md:row-span-3 md:min-h-[520px]"
            label="Loading featured match…"
          />
        )}

        {scoreboard.length > 0 ? (
          <ScoreboardTile matches={scoreboard} />
        ) : liveLoading ? (
          <SkeletonTile className="md:col-span-4 md:row-span-2" label="Loading scoreboard…" />
        ) : (
          <ScoreboardTile matches={scoreboard} />
        )}

        {flashHeadline || !newsLoading ? (
          <FlashNewsTile article={flashHeadline} />
        ) : (
          <SkeletonTile className="md:col-span-4 md:row-span-1" label="Loading headline…" />
        )}

        <ResultsTile matches={recentResults} />
        <GoldenBootTile scorer={topScorer} />
        <FanZoneTile />
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Tiles
 * ══════════════════════════════════════════════════════════════════════════ */

type HeroMatch = {
  href: string;
  homeName: string;
  awayName: string;
  homeCode: string | null;
  awayCode: string | null;
  homeScore: number | null;
  awayScore: number | null;
  utcDate: string | null;
  status: "LIVE" | "PAUSED" | "SCHEDULED" | "FINISHED";
  minute: number | null;
  injury: number | null;
  competition: string;
  venue: string | null;
};

function fromLive(m: LiveMatch): HeroMatch {
  const wc = findWc26MatchByTeams(m.home.name, m.away.name, m.utc_date);
  const status: HeroMatch["status"] =
    m.status === "IN_PLAY" || m.status === "LIVE"
      ? "LIVE"
      : m.status === "PAUSED"
        ? "PAUSED"
        : m.status === "FINISHED"
          ? "FINISHED"
          : "SCHEDULED";
  return {
    href: wc ? `/match/${wc.match_no}` : "/fixtures",
    homeName: m.home.name,
    awayName: m.away.name,
    homeCode: bestFifaCode(m.home.tla, m.home.name),
    awayCode: bestFifaCode(m.away.tla, m.away.name),
    homeScore: m.score.full.home,
    awayScore: m.score.full.away,
    utcDate: m.utc_date,
    status,
    minute: m.minute,
    injury: m.injury_time,
    competition: m.competition,
    venue: wc?.venue_name ?? null,
  };
}

function fromWc(m: Wc26Match): HeroMatch {
  return {
    href: `/match/${m.match_no}`,
    homeName: countryName(m.home_code) || m.home_name,
    awayName: countryName(m.away_code) || m.away_name,
    homeCode: m.home_code,
    awayCode: m.away_code,
    homeScore: m.home_score,
    awayScore: m.away_score,
    utcDate: m.date_utc,
    status: m.home_score != null ? "FINISHED" : "SCHEDULED",
    minute: null,
    injury: null,
    competition: m.stage_label,
    venue: m.venue_name,
  };
}

function useCountdown(iso: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!iso) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [iso]);
  if (!iso) return null;
  const diff = new Date(iso).getTime() - now;
  if (diff <= 0) return null;
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  return { d, h, m, s };
}

function HeroTile({ hero, onWatch }: { hero: HeroMatch; onWatch: () => void }) {
  const isLive = hero.status === "LIVE" || hero.status === "PAUSED";
  const isUpcoming = hero.status === "SCHEDULED";
  const kickoff = hero.utcDate
    ? `${bdDate(hero.utcDate)} · ${bdTime(hero.utcDate)}`
    : hero.competition;
  const chipLabel = isLive
    ? hero.status === "PAUSED"
      ? "HALF TIME"
      : `LIVE · ${hero.minute ?? 0}${hero.injury ? `+${hero.injury}` : ""}'`
    : hero.status === "FINISHED"
      ? "FULL TIME"
      : "MATCHDAY";
  const homeCrest = flagUrl(hero.homeCode, 320);
  const awayCrest = flagUrl(hero.awayCode, 320);
  const countdown = useCountdown(isUpcoming ? hero.utcDate : null);

  return (
    <Link
      to={hero.href}
      aria-label={`Open ${hero.homeName} vs ${hero.awayName} match details`}
      className="group relative flex min-h-[380px] flex-col overflow-hidden rounded-3xl border border-border bg-card transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background md:col-span-8 md:row-span-3 md:min-h-[540px]"
    >
      <img
        src={wc26Emblem.url}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 top-1/2 h-[130%] w-auto -translate-y-1/2 object-contain opacity-[0.07] transition-transform duration-1000 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--can)] via-[var(--gold)] to-[var(--usa)] opacity-70" />

      <div className="relative z-10 flex flex-wrap items-center gap-2 p-5 sm:p-7">
        {isLive ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-destructive px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-destructive-foreground shadow-[0_0_20px_rgba(220,38,38,0.4)]">
            <span className="live-dot" aria-hidden="true" /> {chipLabel}
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-black/50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-foreground/80 backdrop-blur-md">
            {chipLabel}
          </span>
        )}
        <span className="rounded-full border border-border bg-black/50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-foreground/70 backdrop-blur-md">
          {hero.competition}
        </span>
        {hero.utcDate && !isLive && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-black/50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-foreground/70 backdrop-blur-md">
            <Clock className="h-3 w-3" aria-hidden="true" /> {bdShortDate(hero.utcDate)}
          </span>
        )}
      </div>

      <div className="relative z-10 mt-auto flex flex-col gap-6 p-5 sm:p-7">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
          {/* Home team */}
          <div className="flex min-w-0 flex-col items-start gap-2 sm:gap-3">
            {homeCrest && (
              <img
                src={homeCrest}
                alt=""
                aria-hidden="true"
                className="h-10 w-14 rounded-md object-cover ring-1 ring-border sm:h-16 sm:w-24 md:h-20 md:w-28"
              />
            )}
            <p className="display truncate text-xl leading-tight tracking-tight sm:text-3xl md:text-4xl">
              {hero.homeName}
            </p>
          </div>

          {/* VS pill */}
          <span
            aria-hidden="true"
            className="display rounded-full border border-border bg-black/60 px-3 py-1 text-sm text-primary backdrop-blur-md sm:text-lg md:text-2xl"
          >
            VS
          </span>

          {/* Away team */}
          <div className="flex min-w-0 flex-col items-end gap-2 text-right sm:gap-3">
            {awayCrest && (
              <img
                src={awayCrest}
                alt=""
                aria-hidden="true"
                className="h-10 w-14 rounded-md object-cover ring-1 ring-border sm:h-16 sm:w-24 md:h-20 md:w-28"
              />
            )}
            <p className="display truncate text-xl leading-tight tracking-tight sm:text-3xl md:text-4xl">
              {hero.awayName}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          {hero.homeScore != null && hero.awayScore != null ? (
            <p
              className="display text-4xl tabular-nums text-primary sm:text-5xl md:text-6xl"
              aria-live={isLive ? "polite" : undefined}
            >
              {hero.homeScore} : {hero.awayScore}
            </p>
          ) : countdown ? (
            <div
              className="flex flex-wrap items-center gap-2"
              aria-label={`Kick-off in ${countdown.d} days ${countdown.h} hours ${countdown.m} minutes`}
            >
              {[
                { v: countdown.d, l: "Days" },
                { v: countdown.h, l: "Hrs" },
                { v: countdown.m, l: "Min" },
                { v: countdown.s, l: "Sec" },
              ].map((seg) => (
                <div
                  key={seg.l}
                  className="min-w-[3.25rem] rounded-xl border border-border bg-black/60 px-3 py-2 text-center backdrop-blur-md"
                >
                  <p className="display text-2xl tabular-nums leading-none text-foreground sm:text-3xl">
                    {String(seg.v).padStart(2, "0")}
                  </p>
                  <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
                    {seg.l}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground">
              Kick-off · {kickoff}
            </p>
          )}
          {hero.venue && (
            <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <MapPin className="h-3 w-3" aria-hidden="true" /> {hero.venue}
            </p>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onWatch();
            }}
            aria-label={isLive ? "Watch live now" : "Open live TV hub"}
            className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-xs font-black uppercase tracking-[0.25em] text-primary-foreground shadow-lg shadow-primary/30 transition hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:hover:translate-y-0"
          >
            <PlayCircle className="h-4 w-4" aria-hidden="true" />
            {isLive ? "Watch live" : "Live TV"}
          </button>
        </div>
      </div>
    </Link>
  );
}

function ScoreboardTile({ matches }: { matches: HeroMatch[] }) {
  return (
    <section
      aria-labelledby="scoreboard-heading"
      className="flex flex-col justify-between gap-4 rounded-3xl border border-border bg-card p-5 transition-colors hover:border-primary/40 md:col-span-4 md:row-span-2 md:p-6"
    >
      <div className="flex items-center justify-between">
        <h2
          id="scoreboard-heading"
          className="display text-2xl tracking-wider text-foreground/70 sm:text-3xl"
        >
          Scoreboard
        </h2>
      </div>

      <div className="space-y-5">
        {matches.length === 0 && (
          <p className="text-sm text-muted-foreground">No matches to show right now.</p>
        )}
        {matches.map((m, i) => (
          <Link
            key={i}
            to={m.href}
            aria-label={`${m.homeName} versus ${m.awayName}`}
            className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <div className="flex items-center justify-between gap-3">
              <ScoreboardSide code={m.homeCode} name={m.homeName} align="left" />
              <div className="flex flex-col items-center">
                <span className="display text-2xl tabular-nums text-foreground sm:text-3xl">
                  {m.homeScore ?? "–"} <span className="text-muted-foreground/60">:</span>{" "}
                  {m.awayScore ?? "–"}
                </span>
                <span
                  className={`mt-1 text-[10px] font-bold uppercase tracking-[0.2em] ${m.status === "LIVE" || m.status === "PAUSED" ? "text-destructive" : "text-muted-foreground"}`}
                >
                  {m.status === "LIVE"
                    ? `${m.minute ?? 0}${m.injury ? `+${m.injury}` : ""}'`
                    : m.status === "PAUSED"
                      ? "HT"
                      : m.status === "FINISHED"
                        ? "FT"
                        : m.utcDate
                          ? bdTime(m.utcDate)
                          : "TBD"}
                </span>
              </div>
              <ScoreboardSide code={m.awayCode} name={m.awayName} align="right" />
            </div>
            {i < matches.length - 1 && (
              <div
                className="mt-5 h-px bg-gradient-to-r from-transparent via-border to-transparent"
                aria-hidden="true"
              />
            )}
          </Link>
        ))}
      </div>

      <Link
        to="/fixtures"
        className="block min-h-11 rounded-2xl bg-secondary py-3 text-center text-[11px] font-bold uppercase tracking-[0.25em] text-foreground/80 transition hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Full schedule
      </Link>
    </section>
  );
}

function ScoreboardSide({
  code,
  name,
  align,
}: {
  code: string | null;
  name: string;
  align: "left" | "right";
}) {
  const crest = flagUrl(code, 80);
  return (
    <div className={`flex min-w-0 flex-col items-center gap-1 ${align === "left" ? "" : ""}`}>
      {crest ? (
        <img
          src={crest}
          alt=""
          aria-hidden="true"
          className="h-10 w-14 rounded-lg object-cover ring-1 ring-border"
        />
      ) : (
        <div
          className="grid h-10 w-14 place-items-center rounded-lg bg-secondary text-xs font-bold text-foreground/70"
          aria-hidden="true"
        >
          {code ?? "—"}
        </div>
      )}
      <span className="max-w-[6rem] truncate text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
        {code ?? name}
      </span>
    </div>
  );
}

function FlashNewsTile({ article }: { article: Article | null }) {
  const hasImage = !!article?.image_url;
  return (
    <a
      href={article?.url ?? "/news"}
      target={article ? "_blank" : undefined}
      rel="noreferrer"
      aria-label={article ? `Read: ${article.title}` : "Latest news"}
      className="group relative flex min-h-[220px] flex-col justify-end overflow-hidden rounded-3xl bg-[var(--trophy-green)] text-white transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:hover:translate-y-0 md:col-span-4 md:row-span-1"
    >
      {hasImage && (
        <>
          <img
            src={article!.image_url!}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:group-hover:scale-100"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-black/10"
          />
        </>
      )}
      <div className="relative flex items-start gap-3 p-5">
        {!hasImage && (
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-black/25 transition-transform group-hover:scale-110 motion-reduce:group-hover:scale-100">
            <Zap className="h-6 w-6" aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-white/80">
            <Zap className="h-3 w-3" aria-hidden="true" />
            {article?.source ?? "Flash news"}
          </p>
          <p className="mt-1.5 text-sm font-bold leading-snug sm:text-base">
            {article?.title ?? "Latest World Cup 2026 headlines"}
          </p>
        </div>
        <ArrowRight
          className="mt-1 hidden h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1 motion-reduce:group-hover:translate-x-0 sm:block"
          aria-hidden="true"
        />
      </div>
    </a>
  );
}

function ResultsTile({ matches }: { matches: Wc26Match[] }) {
  return (
    <section
      aria-labelledby="results-heading"
      className="rounded-3xl border border-border bg-card p-5 transition-colors hover:border-primary/40 md:col-span-4 md:row-span-2 md:p-6"
    >
      <div className="flex items-center justify-between">
        <h2 id="results-heading" className="display text-2xl tracking-wider sm:text-3xl">
          Recent Results
        </h2>
        <Link
          to="/standings"
          className="rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Table
        </Link>
      </div>

      <ul className="mt-4 space-y-2">
        <li
          className="grid grid-cols-[1fr_auto_1fr] items-center px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60"
          aria-hidden="true"
        >
          <span className="text-left">Home</span>
          <span className="px-3 text-center">Score</span>
          <span className="text-right">Away</span>
        </li>
        {matches.map((m) => (
          <li key={m.match_no}>
            <Link
              to={`/match/${m.match_no}`}
              aria-label={`${countryName(m.home_code) || m.home_name} ${m.home_score} versus ${m.away_score} ${countryName(m.away_code) || m.away_name}`}
              className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-2xl border border-transparent bg-secondary/60 px-3 py-2.5 text-sm transition hover:border-primary/40 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <span className="flex items-center gap-2 truncate font-semibold">
                {flagUrl(m.home_code, 40) && (
                  <img
                    src={flagUrl(m.home_code, 40)!}
                    alt=""
                    aria-hidden="true"
                    className="h-4 w-6 rounded-sm object-cover"
                  />
                )}
                <span className="truncate">{countryName(m.home_code) || m.home_name}</span>
              </span>
              <span className="display px-2 tabular-nums text-primary">
                {m.home_score} : {m.away_score}
              </span>
              <span className="flex items-center justify-end gap-2 truncate font-semibold">
                <span className="truncate">{countryName(m.away_code) || m.away_name}</span>
                {flagUrl(m.away_code, 40) && (
                  <img
                    src={flagUrl(m.away_code, 40)!}
                    alt=""
                    aria-hidden="true"
                    className="h-4 w-6 rounded-sm object-cover"
                  />
                )}
              </span>
            </Link>
            {m.date_utc && (
              <p className="mt-1 px-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
                {bdShortDate(m.date_utc)} · {m.stage_label}
              </p>
            )}
          </li>
        ))}
        {matches.length === 0 && <li className="text-sm text-muted-foreground">No results yet.</li>}
      </ul>
    </section>
  );
}

function GoldenBootTile({
  scorer,
}: {
  scorer: { player: string; goals: number; team: string } | null;
}) {
  return (
    <Link
      to="/standings?tab=scorers"
      aria-label={
        scorer
          ? `Golden Boot leader: ${scorer.player} with ${scorer.goals} goals`
          : "Golden Boot leader"
      }
      className="group relative flex flex-col justify-between overflow-hidden rounded-3xl bg-primary p-6 text-primary-foreground transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:hover:translate-y-0 md:col-span-4 md:row-span-2"
    >
      <img
        src={wc26Emblem.url}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 top-1/2 h-[110%] w-auto -translate-y-1/2 object-contain opacity-30 mix-blend-multiply transition-transform duration-700 group-hover:scale-110 motion-reduce:group-hover:scale-100"
      />
      <div className="relative z-10">
        <span className="rounded-lg bg-black px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-primary">
          Top scorer
        </span>
        <h3 className="display mt-4 text-4xl leading-none sm:text-5xl">
          Golden
          <br />
          Boot
        </h3>
      </div>
      <div className="relative z-10 mt-6 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p
            className="truncate text-base font-black uppercase leading-tight sm:text-lg"
            title={scorer?.player}
          >
            {scorer?.player ?? "TBD"}
          </p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-primary-foreground/80">
            {scorer
              ? `${scorer.goals} goal${scorer.goals === 1 ? "" : "s"} · ${scorer.team}`
              : "No goals yet"}
          </p>
        </div>
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-black transition-transform group-hover:scale-110 motion-reduce:group-hover:scale-100">
          <ArrowRight className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
      </div>
    </Link>
  );
}

function FanZoneTile() {
  return (
    <Link
      to="/live-tv"
      aria-label="Open the live TV fan hub"
      className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border bg-card p-6 transition-colors hover:border-[var(--trophy-green)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background md:col-span-4 md:row-span-2"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(212,175,55,0.18),transparent_60%)]" />
      <div className="relative">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
          <Trophy className="h-5 w-5" aria-hidden="true" />
        </div>
        <h3 className="display mt-4 text-3xl leading-none sm:text-4xl">
          Live The
          <br />
          <span className="text-[var(--trophy-green)]">Tournament</span>
        </h3>
      </div>
      <p className="relative text-sm text-muted-foreground">
        Every match streamed in HD & 4K, with live scores, timelines and goals.
      </p>
      <span className="relative block w-full rounded-2xl border-2 border-[var(--trophy-green)] py-4 text-center text-[11px] font-black uppercase tracking-[0.25em] text-[var(--trophy-green)] transition group-hover:bg-[var(--trophy-green)] group-hover:text-white">
        Enter Fan Hub
      </span>
    </Link>
  );
}

function SkeletonTile({ className, label }: { className: string; label: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className={`relative overflow-hidden rounded-3xl border border-border bg-card ${className}`}
    >
      <div
        className="absolute inset-0 animate-pulse bg-gradient-to-br from-secondary/40 via-transparent to-secondary/20"
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Helpers
 * ══════════════════════════════════════════════════════════════════════════ */

function abbr(name: string): string {
  const clean = name.trim();
  if (clean.length <= 4) return clean.toUpperCase();
  const first = clean.split(/\s+/)[0];
  return (first.length <= 4 ? first : clean.slice(0, 3)).toUpperCase();
}
