import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Seo } from "@/lib/seo";
import LiveTicker, { useLiveMatches } from "@/components/LiveTicker";

import heroImg from "@/assets/hero-stadium.jpg";
import wc26Emblem from "@/assets/wc26-trophy.png.asset.json";
import { bdTime, bdDate } from "@/lib/flags";

type Article = {
  id: string; title: string; url: string; source: string;
  summary: string; image_url: string | null; published_at: string | null;
};

const NEWS_FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/news-feed`;

/**
 * Landing page with hero match, live ticker, and latest news.
 */

export default function Home() {
  const navigate = useNavigate();
  const { data: liveData } = useLiveMatches();
  const matches = liveData?.matches ?? [];
  // Select a "hero" match to feature (live/upcoming).
  const hero =
    matches.find((m) => ["IN_PLAY", "PAUSED", "LIVE"].includes(m.status)) ??
    matches.find((m) => m.status === "SCHEDULED" || m.status === "TIMED") ??
    null;

  const { data: newsData, isError: newsError } = useQuery({
    // Fetch latest news headlines from Supabase edge function.
    queryKey: ["news-feed-home"],
    refetchInterval: 300_000,
    queryFn: async () => {
      const res = await fetch(NEWS_FN, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } });
      if (!res.ok) throw new Error(`News feed failed (${res.status})`);
      return res.json() as Promise<{ articles: Article[] }>;
    },
  });
  const news = (newsData?.articles ?? []).slice(0, 4);

  return (
    <div>
      <Seo
        title="Watch FIFA World Cup 2026 Live Free — Semifinals, Final & Every Match | Pitch26"
        description="Watch FIFA World Cup 2026 live free — semifinals, final and every match in HD & 4K. Live scores, fixtures, groups, standings and top scorers, updated by the second."
        path="/"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          "name": "Watch FIFA World Cup 2026 Live Free",
          "description": "Stream every FIFA World Cup 2026 match live and free — including the semifinals and the final — with live scores and stats.",
          "url": "https://pitch26.muhammadsaadabdullah.com/",
        }}
      />
      <section className="relative isolate overflow-hidden">
        <img src={heroImg} alt="" width={1920} height={1080} fetchPriority="high" decoding="async" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-30" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background/70 via-background/80 to-background" />
        <img src={wc26Emblem.url} alt="" aria-hidden="true" className="pointer-events-none absolute -right-8 top-0 -z-10 h-[380px] w-auto opacity-30 md:h-[620px] md:opacity-90" />
        
        <div className="mx-auto max-w-7xl px-4 pb-12 pt-10 md:pt-16">
          <div className="flex items-center gap-3">
            <img src={wc26Emblem.url} alt="FIFA World Cup 26" width={72} height={100} className="h-14 w-auto md:h-20 object-contain" />
            <p className="display text-primary tracking-[0.3em] text-xs md:text-sm">USA · CANADA · MEXICO · 2026</p>
          </div>
          <h1 className="display mt-4 text-5xl md:text-8xl leading-[0.9]">
            The tournament,<br /><span className="tri-text">by the second.</span>
          </h1>
          <p className="mt-4 max-w-xl text-muted-foreground">
            Live scores, live timelines, live goals — for the World Cup and every big football match happening right now.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/fixtures" className="rounded-md bg-primary px-5 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-lg shadow-primary/30 hover:brightness-110 transition">See fixtures</Link>
            <Link to="/live-tv" className="rounded-md border border-border bg-secondary/60 px-5 py-3 text-sm font-bold uppercase tracking-wider hover:border-primary transition">Live TV</Link>
          </div>

          {/* Featured Hero Match Card */}
          {hero && (() => {
            const isPaused = hero.status === "PAUSED";
            const isLive = ["IN_PLAY", "LIVE"].includes(hero.status) || isPaused;
            const statusEl = isPaused
              ? <><span className="live-dot mr-2 align-middle" />Half-time</>
              : ["IN_PLAY", "LIVE"].includes(hero.status)
                ? <><span className="live-dot mr-2 align-middle" />Live · {hero.minute ?? 0}{hero.injury_time ? `+${hero.injury_time}` : ""}'</>
                : `Kick-off · ${bdDate(hero.utc_date)} · ${bdTime(hero.utc_date)}`;
            return (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}>
                <Link to={`/match/${hero.id}`}
                  className={`mt-10 block rounded-xl border border-border bg-card/85 p-6 shadow-2xl transition hover:-translate-y-0.5 hover:border-primary ${isLive ? "live-shimmer" : ""}`}
                >
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    <span className="font-bold text-primary">{statusEl}</span>
                    <span>{hero.competition}</span>
                  </div>
                  <div className="mt-6 grid grid-cols-3 items-center gap-4">
                    <div className="flex flex-col items-end gap-2 text-right">
                      {hero.home.crest && <img src={hero.home.crest} alt={hero.home.name} className="h-14 w-14 object-contain" />}
                      <p className="display text-xl md:text-3xl leading-tight">{hero.home.name}</p>
                    </div>
                    <div className="text-center">
                      <AnimatePresence mode="popLayout">
                        <motion.p
                          key={`${hero.score.full.home}-${hero.score.full.away}`}
                          initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.15, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 220, damping: 18 }}
                          className="display text-5xl md:text-7xl text-primary tabular-nums"
                        >
                          {hero.score.full.home ?? "–"} : {hero.score.full.away ?? "–"}
                        </motion.p>
                      </AnimatePresence>
                      {hero.score.half.home !== null && (
                        <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                          HT {hero.score.half.home}–{hero.score.half.away}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-start gap-2 text-left">
                      {hero.away.crest && <img src={hero.away.crest} alt={hero.away.name} className="h-14 w-14 object-contain" />}
                      <p className="display text-xl md:text-3xl leading-tight">{hero.away.name}</p>
                    </div>
                  </div>
                  {isLive && (
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate("/live-tv"); }}
                        className="group/btn relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-primary px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-primary-foreground shadow-lg shadow-primary/30 transition hover:scale-[1.03]"
                      >
                        <span className="live-dot" />
                        <span>Watch this game live</span>
                        <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover/btn:translate-x-full" />
                      </button>
                      <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                        Streaming now on Pitch26
                      </span>
                    </div>
                  )}
                </Link>
              </motion.div>
            );
          })()}
        </div>
      </section>

      <LiveTicker />

      <section className="mx-auto max-w-7xl px-4 pb-16 pt-10">
        <h2 className="display text-3xl">Latest news</h2>
        {newsError ? (
          <p className="mt-4 text-sm text-destructive">Could not load headlines right now.</p>
        ) : news.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading headlines…</p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {news.map((n) => (
              <a key={n.id} href={n.url} target="_blank" rel="noreferrer" className="group rounded-lg border border-border bg-card/40 p-4 transition hover:border-primary">
                <p className="text-xs uppercase tracking-wider text-primary">{n.source}</p>
                <p className="mt-2 font-semibold group-hover:text-primary">{n.title}</p>
                {n.summary && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{n.summary}</p>}
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
