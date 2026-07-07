import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { bdTime } from "@/lib/flags";

export type LiveMatch = {
  id: number;
  competition: string;
  competition_code: string;
  status: string;
  minute: number | null;
  injury_time: number | null;
  utc_date: string;
  home: { name: string; tla: string; crest: string };
  away: { name: string; tla: string; crest: string };
  score: { full: { home: number | null; away: number | null }; half: { home: number | null; away: number | null } };
};

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/live-matches`;

export function useLiveMatches() {
  return useQuery({
    queryKey: ["live-matches"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const res = await fetch(FN_URL, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } });
      if (!res.ok) throw new Error(`Live matches request failed (${res.status})`);
      return res.json() as Promise<{ matches: LiveMatch[] }>;
    },
  });
}

export default function LiveTicker() {
  const { data, isError } = useLiveMatches();
  const matches = data?.matches ?? [];
  const live = matches.filter((m) => ["IN_PLAY", "PAUSED", "LIVE"].includes(m.status));
  const upcoming = matches.filter((m) => m.status === "SCHEDULED" || m.status === "TIMED").slice(0, 3);
  const finished = matches.filter((m) => m.status === "FINISHED").slice(0, 3);

  if (isError || matches.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 pb-6 pt-4">
      <div className="flex items-baseline justify-between">
        <h2 className="display text-3xl">Live around the world</h2>
      </div>

      {live.length > 0 && (
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {live.map((m) => <LiveCard key={m.id} m={m} />)}
        </div>
      )}

      {(upcoming.length > 0 || finished.length > 0) && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {upcoming.length > 0 && <MiniList title="Kicking off soon" items={upcoming} showTime />}
          {finished.length > 0 && <MiniList title="Full time today" items={finished} />}
        </div>
      )}
    </section>
  );
}

function LiveCard({ m }: { m: LiveMatch }) {
  const min =
    m.status === "PAUSED" ? "HT"
    : m.minute ? `${m.minute}${m.injury_time ? `+${m.injury_time}` : ""}'`
    : "LIVE";
  return (
    <Link to={`/match/${m.id}`} className="live-shimmer block rounded-xl border border-primary/40 bg-card/70 p-4 shadow-lg transition hover:-translate-y-0.5 hover:border-primary">
      <div className="flex items-center justify-between text-xs uppercase tracking-wider">
        <span className="text-primary font-bold">
          <span className="live-dot mr-2 align-middle" />{min}
        </span>
        <span className="text-muted-foreground">{m.competition}</span>
      </div>
      <div className="mt-3 space-y-2">
        <TeamRow name={m.home.name} tla={m.home.tla} crest={m.home.crest} score={m.score.full.home} />
        <TeamRow name={m.away.name} tla={m.away.tla} crest={m.away.crest} score={m.score.full.away} />
      </div>
    </Link>
  );
}

function TeamRow({ name, tla, crest, score }: { name: string; tla: string; crest: string; score: number | null }) {
  return (
    <div className="flex items-center gap-3">
      {crest && <img src={crest} alt="" className="h-6 w-6 object-contain" loading="lazy" />}
      <span className="flex-1 truncate font-semibold">{name}</span>
      <span className="text-xs text-muted-foreground">{tla}</span>
      <span className="display text-2xl text-primary tabular-nums">{score ?? "–"}</span>
    </div>
  );
}

function MiniList({ title, items, showTime }: { title: string; items: LiveMatch[]; showTime?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card/40 p-4">
      <h3 className="display text-lg text-primary">{title}</h3>
      <ul className="mt-2 divide-y divide-border">
        {items.map((m) => (
          <li key={m.id} className="py-2 text-sm">
            <Link to={`/match/${m.id}`} className="flex items-center gap-3 hover:text-primary">
              <span className="w-20 text-xs uppercase tracking-wider text-muted-foreground">
                {showTime ? bdTime(m.utc_date) : "FT"}
              </span>
              <span className="flex-1 truncate">{m.home.name}</span>
              <span className="display text-primary tabular-nums">
                {showTime ? "v" : `${m.score.full.home}–${m.score.full.away}`}
              </span>
              <span className="flex-1 truncate text-right">{m.away.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
