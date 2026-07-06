import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Seo } from "@/lib/seo";
import { format } from "date-fns";

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

const FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/match-detail`;

async function fetchWiki(title: string) {
  const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
  if (!res.ok) return null;
  return res.json() as Promise<{ extract: string; content_urls?: { desktop: { page: string } } }>;
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

  const isLive = m && ["IN_PLAY", "PAUSED", "LIVE"].includes(m.status);

  if (isLoading || !m) return <div className="mx-auto max-w-4xl px-4 py-12"><p className="text-muted-foreground">Loading match…</p></div>;

  const min = m.minute ? `${m.minute}${m.injury_time ? `+${m.injury_time}` : ""}'` : m.status === "PAUSED" ? "Half-time" : m.status === "FINISHED" ? "Full time" : format(new Date(m.utc_date), "EEE d MMM · HH:mm");

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <Seo
        title={`${m.home.name} vs ${m.away.name} — Live | Pitch26`}
        description={`${m.competition} · ${m.home.name} vs ${m.away.name} live score, timeline and goals.`}
        path={`/match/${m.id}`}
      />
      <Link to="/" className="text-xs uppercase tracking-wider text-primary">← Home</Link>

      <div className={`mt-4 rounded-xl border border-border bg-card/85 p-6 shadow-2xl ${isLive ? "live-shimmer" : ""}`}>
        <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
          <span className="text-primary font-bold">
            {isLive && <span className="live-dot mr-2 align-middle" />}{min}
          </span>
          <span>{m.competition}</span>
        </div>
        <div className="mt-6 grid grid-cols-3 items-center gap-4">
          <Link to={`/team/${encodeURIComponent(m.home.name)}`} className="flex flex-col items-end gap-2 text-right hover:text-primary">
            {m.home.crest && <img src={m.home.crest} alt={m.home.name} className="h-16 w-16 object-contain" />}
            <p className="display text-2xl md:text-3xl">{m.home.name}</p>
          </Link>
          <div className="text-center">
            <p className="display text-6xl md:text-7xl text-primary tabular-nums">
              {m.score.full.home ?? "–"} : {m.score.full.away ?? "–"}
            </p>
            {m.score.half.home !== null && (
              <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                HT {m.score.half.home}–{m.score.half.away}
              </p>
            )}
          </div>
          <Link to={`/team/${encodeURIComponent(m.away.name)}`} className="flex flex-col items-start gap-2 text-left hover:text-primary">
            {m.away.crest && <img src={m.away.crest} alt={m.away.name} className="h-16 w-16 object-contain" />}
            <p className="display text-2xl md:text-3xl">{m.away.name}</p>
          </Link>
        </div>
        {(m.venue || m.referees.length > 0) && (
          <p className="mt-4 text-center text-xs uppercase tracking-wider text-muted-foreground">
            {m.venue}{m.venue && m.referees.length > 0 ? " · " : ""}{m.referees.length > 0 && `Ref: ${m.referees[0]}`}
          </p>
        )}
      </div>

      <section className="mt-8">
        <h2 className="display text-2xl text-primary">Timeline</h2>
        {m.goals.length === 0 && m.bookings.length === 0 && (
          <p className="mt-3 text-sm text-muted-foreground">No goals or cards yet.</p>
        )}
        <ol className="mt-4 relative border-l-2 border-primary/30 pl-6">
          {[...m.goals.map((g) => ({ kind: "goal" as const, minute: g.minute, injury: g.injury_time, data: g })),
            ...m.bookings.map((b) => ({ kind: "card" as const, minute: b.minute, injury: null, data: b }))]
            .sort((a, b) => a.minute - b.minute)
            .map((ev, i) => (
              <li key={i} className="relative mb-6">
                <span className="absolute -left-[33px] flex h-6 w-6 items-center justify-center rounded-full bg-background border-2 border-primary text-xs">
                  {ev.kind === "goal" ? "⚽" : ev.data && "card" in ev.data && (ev.data as Booking).card?.includes("RED") ? "🟥" : "🟨"}
                </span>
                <div className="rounded-lg border border-border bg-card/40 p-3">
                  <p className="text-xs uppercase tracking-wider text-primary">
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
              </li>
            ))}
        </ol>
      </section>
    </div>
  );
}
