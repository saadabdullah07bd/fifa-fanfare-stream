import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getAllMatches, getTeams } from "@/lib/data.functions";
import { listMyPredictions, upsertPrediction } from "@/lib/user.functions";
import { getLeaderboard } from "@/lib/leaderboard.functions";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/predictions")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Predictions — Pitch26" },
      { name: "description", content: "Predict every FIFA World Cup 2026 match and climb the community leaderboard." },
    ],
  }),
  component: PredictionsPage,
});

function PredictionsPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
  }, []);

  const matchesFn = useServerFn(getAllMatches);
  const teamsFn = useServerFn(getTeams);
  const leaderFn = useServerFn(getLeaderboard);
  const myFn = useServerFn(listMyPredictions);
  const upsertFn = useServerFn(upsertPrediction);

  const { data: matches = [] } = useQuery({ queryKey: ["matches"], queryFn: () => matchesFn() });
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => teamsFn() });
  const { data: leader = [] } = useQuery({ queryKey: ["leaderboard"], queryFn: () => leaderFn() });
  const { data: mine = [], refetch } = useQuery({ queryKey: ["mine"], queryFn: () => myFn(), enabled: !!authed });

  const teamName = (code: string | null) => teams.find((t) => t.code === code)?.name ?? code ?? "TBD";
  const upcoming = matches.filter((m) => new Date(m.date_utc) > new Date()).slice(0, 20);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="display text-5xl">Predictions</h1>
      <p className="mt-2 text-muted-foreground">3 pts for exact score · 1 pt for correct outcome.</p>

      {authed === false && (
        <div className="mt-6 rounded-lg border border-border bg-card/40 p-4 text-sm">
          <Link to="/auth" className="text-primary underline">Sign in with Google</Link> to submit predictions.
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <h2 className="display text-2xl">Upcoming matches</h2>
          <div className="mt-4 space-y-3">
            {upcoming.map((m) => {
              const my = mine.find((p) => p.match_id === m.id);
              return (
                <PredictRow
                  key={m.id}
                  matchId={m.id}
                  date={m.date_utc}
                  home={teamName(m.home_team_code)}
                  away={teamName(m.away_team_code)}
                  homeStart={my?.home_score ?? 0}
                  awayStart={my?.away_score ?? 0}
                  disabled={!authed}
                  onSave={async (h, a) => {
                    try {
                      await upsertFn({ data: { matchId: m.id, homeScore: h, awayScore: a } });
                      toast.success("Prediction saved");
                      await refetch();
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                />
              );
            })}
            {upcoming.length === 0 && <p className="text-sm text-muted-foreground">No upcoming matches yet.</p>}
          </div>
        </div>

        <aside>
          <h2 className="display text-2xl">Leaderboard</h2>
          <ol className="mt-4 space-y-2 rounded-lg border border-border bg-card/40 p-3">
            {leader.length === 0 && <li className="text-sm text-muted-foreground">No predictions yet.</li>}
            {leader.map((row, i) => (
              <li key={row.user_id} className="flex items-center gap-3 text-sm">
                <span className="w-6 text-muted-foreground">{i + 1}</span>
                {row.avatar_url ? (
                  <img src={row.avatar_url} alt="" className="h-7 w-7 rounded-full" />
                ) : (
                  <div className="grid h-7 w-7 place-items-center rounded-full bg-primary/20 text-xs">
                    {row.display_name.slice(0, 1)}
                  </div>
                )}
                <span className="flex-1 truncate">{row.display_name}</span>
                <span className="font-bold text-primary">{row.points}</span>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}

function PredictRow({
  matchId,
  date,
  home,
  away,
  homeStart,
  awayStart,
  disabled,
  onSave,
}: {
  matchId: string;
  date: string;
  home: string;
  away: string;
  homeStart: number;
  awayStart: number;
  disabled: boolean;
  onSave: (h: number, a: number) => void;
}) {
  const [h, setH] = useState(homeStart);
  const [a, setA] = useState(awayStart);
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card/40 p-3">
      <div className="flex-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {new Date(date).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
        </p>
        <p className="mt-1 text-sm font-semibold">{home} vs {away}</p>
      </div>
      <div className="flex items-center gap-2">
        <ScoreInput value={h} onChange={setH} />
        <span className="text-muted-foreground">–</span>
        <ScoreInput value={a} onChange={setA} />
        <button
          disabled={disabled}
          onClick={() => onSave(h, a)}
          className="ml-2 rounded-md bg-primary px-3 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-40"
          data-testid={`save-${matchId}`}
        >
          Save
        </button>
      </div>
    </div>
  );
}

function ScoreInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <input
      type="number"
      min={0}
      max={20}
      value={value}
      onChange={(e) => onChange(Math.max(0, Math.min(20, Number(e.target.value) || 0)))}
      className="w-12 rounded-md border border-border bg-input px-2 py-2 text-center text-sm"
    />
  );
}
