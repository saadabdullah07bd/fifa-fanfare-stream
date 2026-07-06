import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Seo } from "@/lib/seo";
import LiveTicker, { useLiveMatches } from "@/components/LiveTicker";
import heroImg from "@/assets/hero-stadium.jpg";
import { format } from "date-fns";

type Article = {
  id: string; title: string; url: string; source: string;
  summary: string; image_url: string | null; published_at: string | null;
};

const NEWS_FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/news-feed`;

export default function Home() {
  const { data: liveData } = useLiveMatches();
  const matches = liveData?.matches ?? [];
  const hero =
    matches.find((m) => ["IN_PLAY", "PAUSED", "LIVE"].includes(m.status)) ??
    matches.find((m) => m.status === "SCHEDULED" || m.status === "TIMED") ??
    null;

  const { data: newsData } = useQuery({
    queryKey: ["news-feed-home"],
    refetchInterval: 300_000,
    queryFn: async () => {
      const res = await fetch(NEWS_FN, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } });
      return res.json() as Promise<{ articles: Article[] }>;
    },
  });
  const news = (newsData?.articles ?? []).slice(0, 4);

  return (
    <div>
      <Seo
        title="Pitch26 — Live football scores & FIFA World Cup 2026 hub"
        description="Live scores, timelines, fixtures, and standings for the FIFA World Cup 2026 and every big football match today."
        path="/"
      />
      <section className="relative isolate overflow-hidden">
        <img src={heroImg} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-40" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background/60 via-background/70 to-background" />
        <div className="mx-auto max-w-7xl px-4 pb-12 pt-16 md:pt-24">
          <p className="display text-primary tracking-[0.3em] text-sm">USA · CANADA · MEXICO · 2026</p>
          <h1 className="display mt-2 text-5xl md:text-7xl leading-none">
            The tournament,<br /><span className="text-primary">by the second.</span>
          </h1>
          <p className="mt-4 max-w-xl text-muted-foreground">
            Live scores, live timelines, live goals — for the World Cup and every big football match happening right now.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/fixtures" className="rounded-md bg-primary px-5 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground">See fixtures</Link>
            <Link to="/live-tv" className="rounded-md border border-border bg-secondary/60 px-5 py-3 text-sm font-bold uppercase tracking-wider">Live TV</Link>
          </div>

          {hero && (
            <Link
              to={`/match/${hero.id}`}
              className={`mt-10 block rounded-xl border border-border bg-card/85 p-6 shadow-2xl transition hover:border-primary ${["IN_PLAY", "PAUSED", "LIVE"].includes(hero.status) ? "live-shimmer" : ""}`}
            >
              <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
                <span className="text-primary font-bold">
                  {["IN_PLAY", "LIVE"].includes(hero.status)
                    ? <><span className="live-dot mr-2 align-middle" />Live · {hero.minute ?? 0}{hero.injury_time ? `+${hero.injury_time}` : ""}'</>
                    : hero.status === "PAUSED"
                      ? <><span className="live-dot mr-2 align-middle" />Half-time</>
                      : `Kick-off · ${format(new Date(hero.utc_date), "EEE d MMM · HH:mm")}`}
                </span>
                <span>{hero.competition}</span>
              </div>
              <div className="mt-6 grid grid-cols-3 items-center gap-4">
                <div className="flex flex-col items-end gap-2 text-right">
                  {hero.home.crest && <img src={hero.home.crest} alt={hero.home.name} className="h-14 w-14 object-contain" />}
                  <p className="display text-xl md:text-3xl leading-tight">{hero.home.name}</p>
                </div>
                <div className="text-center">
                  <p className="display text-5xl md:text-7xl text-primary tabular-nums">
                    {hero.score.full.home ?? "–"} : {hero.score.full.away ?? "–"}
                  </p>
                  {hero.score.half.home !== null && (
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      HT {hero.score.half.home}–{hero.score.half.away}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-start gap-2 text-left">
                  {hero.away.crest && <img src={hero.away.crest} alt={hero.away.name} className="h-14 w-14 object-contain" />}
                  <p className="display text-xl md:text-3xl leading-tight">{hero.away.name}</p>
                </div>
              </div>
              <p className="mt-4 text-center text-xs uppercase tracking-wider text-muted-foreground">Tap for live timeline →</p>
            </Link>
          )}
        </div>
      </section>

      <LiveTicker />

      <section className="mx-auto max-w-7xl px-4 pb-16">
        <h2 className="display text-3xl">Latest news</h2>
        {news.length === 0 ? (
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
