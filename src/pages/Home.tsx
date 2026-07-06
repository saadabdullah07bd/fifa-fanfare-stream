import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/lib/seo";
import LiveTicker from "@/components/LiveTicker";
import heroImg from "@/assets/hero-stadium.jpg";
import { format } from "date-fns";

export default function Home() {
  const { data } = useQuery({
    queryKey: ["home"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const now = new Date().toISOString();
      const [live, upcoming, scorers, news] = await Promise.all([
        supabase.from("matches").select("*").eq("status", "live").order("date_utc"),
        supabase.from("matches").select("*").gt("date_utc", now).order("date_utc").limit(6),
        supabase.from("scorers").select("*").order("goals", { ascending: false }).limit(5),
        supabase.from("news").select("*").order("published_at", { ascending: false }).limit(4),
      ]);
      return { live: live.data ?? [], upcoming: upcoming.data ?? [], scorers: scorers.data ?? [], news: news.data ?? [] };
    },
  });

  const live = data?.live ?? [];
  const upcoming = data?.upcoming ?? [];
  const scorers = data?.scorers ?? [];
  const news = data?.news ?? [];
  const heroMatch = live[0] ?? upcoming[0];

  return (
    <div>
      <Seo title="Pitch26 — FIFA World Cup 2026 hub" description="Live scores, fixtures, groups and match streaming for the 2026 World Cup." />
      <section className="relative isolate overflow-hidden">
        <img src={heroImg} alt="Packed stadium at dusk" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-40" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background/60 via-background/70 to-background" />
        <div className="mx-auto max-w-7xl px-4 pb-12 pt-16 md:pt-24">
          <p className="display text-primary tracking-[0.3em] text-sm">USA · CANADA · MEXICO · 2026</p>
          <h1 className="display mt-2 text-5xl md:text-7xl leading-none">
            The tournament,<br /><span className="text-primary">by the second.</span>
          </h1>
          <p className="mt-4 max-w-xl text-muted-foreground">
            48 teams. 16 host cities. Live scores, fixtures, standings, top scorers, venues and match streaming — updated every hour.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/fixtures" className="rounded-md bg-primary px-5 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground">See fixtures</Link>
            <Link to="/live-tv" className="rounded-md border border-border bg-secondary/60 px-5 py-3 text-sm font-bold uppercase tracking-wider">Live TV</Link>
          </div>

          {heroMatch && (
            <div className={`mt-10 rounded-xl border border-border bg-card/80 p-6 shadow-2xl ${heroMatch.status === "live" ? "live-shimmer" : ""}`}>
              <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
                <span>{heroMatch.status === "live" ? <><span className="live-dot mr-2 align-middle" />Live · {heroMatch.minute ?? ""}</> : `Kick-off · ${format(new Date(heroMatch.date_utc), "EEE d MMM · HH:mm")}`}</span>
                <span>{heroMatch.stage}{heroMatch.group ? ` · Group ${heroMatch.group}` : ""}</span>
              </div>
              <div className="mt-4 grid grid-cols-3 items-center gap-4">
                <div className="text-right"><p className="display text-2xl md:text-4xl">{heroMatch.home_team_code ?? "TBD"}</p></div>
                <div className="text-center"><p className="display text-5xl md:text-7xl text-primary">{heroMatch.home_score ?? "–"} : {heroMatch.away_score ?? "–"}</p></div>
                <div className="text-left"><p className="display text-2xl md:text-4xl">{heroMatch.away_team_code ?? "TBD"}</p></div>
              </div>
            </div>
          )}
        </div>
      </section>

      <LiveTicker />

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-3">
        <div className="md:col-span-2">
          <h2 className="display text-3xl">Upcoming</h2>
          <ul className="mt-4 divide-y divide-border rounded-lg border border-border bg-card/40">
            {upcoming.length === 0 && <li className="p-6 text-sm text-muted-foreground">No fixtures yet. Data auto-refreshes hourly.</li>}
            {upcoming.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-4 p-4">
                <span className="text-xs uppercase tracking-wider text-muted-foreground w-32">{format(new Date(m.date_utc), "EEE d MMM · HH:mm")}</span>
                <span className="display flex-1 text-right text-xl">{m.home_team_code ?? "TBD"}</span>
                <span className="text-muted-foreground text-sm">vs</span>
                <span className="display flex-1 text-xl">{m.away_team_code ?? "TBD"}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="display text-3xl">Golden Boot</h2>
          <ul className="mt-4 space-y-2 rounded-lg border border-border bg-card/40 p-3">
            {scorers.length === 0 && <li className="p-3 text-sm text-muted-foreground">No goals yet.</li>}
            {scorers.map((s, i) => (
              <li key={s.id} className="flex items-center justify-between rounded px-3 py-2 hover:bg-secondary/50">
                <span className="flex items-center gap-3">
                  <span className="display w-6 text-primary">{i + 1}</span>
                  <span>{s.player}</span>
                  <span className="text-xs text-muted-foreground">{s.team_code}</span>
                </span>
                <span className="display text-xl text-primary">{s.goals}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16">
        <h2 className="display text-3xl">Latest news</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {news.length === 0 && <p className="text-sm text-muted-foreground">No news yet.</p>}
          {news.map((n) => (
            <a key={n.id} href={n.url} target="_blank" rel="noreferrer" className="group rounded-lg border border-border bg-card/40 p-4 transition hover:border-primary">
              <p className="text-xs uppercase tracking-wider text-primary">{n.source}</p>
              <p className="mt-2 font-semibold group-hover:text-primary">{n.title}</p>
              {n.summary && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{n.summary}</p>}
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
