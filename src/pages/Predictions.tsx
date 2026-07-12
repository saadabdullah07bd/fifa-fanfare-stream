import { Link } from "react-router-dom";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Seo } from "@/lib/seo";
import { toast } from "sonner";

/**
 * Community predictions page where users can guess match scores and view leaderboards.
 */

export default function Predictions() {
  const { user, ready } = useAuth();
  const qc = useQueryClient();

  const { data: matches = [], isLoading: matchesLoading, isError: matchesError } = useQuery({
    queryKey: ["matches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("matches").select("*").order("date_utc");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
  const { data: teams = [], isError: teamsError } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("*");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
  const { data: mine = [], isError: mineError } = useQuery({
    // Fetch current user's existing predictions.
    queryKey: ["predictions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("predictions").select("*").eq("user_id", user!.id);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
  const { data: leader = [], isError: leaderboardError } = useQuery({
    // Calculate global points leaderboard from all user predictions.
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const [preds, profiles] = await Promise.all([
        supabase.from("predictions").select("user_id, points"),
        supabase.from("profiles").select("id, display_name, avatar_url"),
      ]);
      if (preds.error) throw new Error(preds.error.message);
      if (profiles.error) throw new Error(profiles.error.message);
      const totals = new Map<string, { points: number; count: number }>();
      for (const p of preds.data ?? []) {
        const t = totals.get(p.user_id) ?? { points: 0, count: 0 };
        t.points += p.points ?? 0; t.count += 1;
        totals.set(p.user_id, t);
      }
      return Array.from(totals.entries())
        .map(([uid, v]) => {
          const p = (profiles.data ?? []).find((x) => x.id === uid);
          return { user_id: uid, points: v.points, predictions: v.count, display_name: p?.display_name ?? "Fan", avatar_url: p?.avatar_url ?? null };
        })
        .sort((a, b) => b.points - a.points || b.predictions - a.predictions)
        .slice(0, 50);
    },
  });

  const teamName = (code: string | null) => teams.find((t) => t.code === code)?.name ?? code ?? "TBD";
  const upcoming = matches.filter((m) => new Date(m.date_utc) > new Date()).slice(0, 20);

  /** Persists a user's score prediction to the database. */
  async function save(matchId: string, h: number, a: number) {
    if (!user) return;
    const { error } = await supabase.from("predictions").upsert(
      { user_id: user.id, match_id: matchId, home_score: h, away_score: a, updated_at: new Date().toISOString() },
      { onConflict: "user_id,match_id" },
    );
    if (error) return toast.error(error.message);
    toast.success("Prediction saved");
    qc.invalidateQueries({ queryKey: ["predictions", user.id] });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Seo title="Predictions — Pitch26" description="Predict every FIFA World Cup 2026 match and climb the community leaderboard." />
      <h1 className="display text-5xl">Predictions</h1>
      <p className="mt-2 text-muted-foreground">3 pts for exact score · 1 pt for correct outcome.</p>

      {ready && !user && (
        <div className="mt-6 rounded-lg border border-border bg-card/40 p-4 text-sm">
          <Link to="/auth" className="text-primary underline">Sign in with Google</Link> to submit predictions.
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <h2 className="display text-2xl">Upcoming matches</h2>
          {matchesLoading && <p className="mt-4 text-sm text-muted-foreground">Loading matches…</p>}
          {(matchesError || teamsError || mineError) && (
            <p className="mt-4 text-sm text-destructive">Could not load predictions data right now.</p>
          )}
          <div className="mt-4 space-y-3">
            {upcoming.map((m) => {
              const my = mine.find((p) => p.match_id === m.id);
              return (
                <PredictRow key={m.id} matchId={m.id} date={m.date_utc}
                  home={teamName(m.home_team_code)} away={teamName(m.away_team_code)}
                  homeStart={my?.home_score ?? 0} awayStart={my?.away_score ?? 0}
                  disabled={!user} onSave={(h, a) => save(m.id, h, a)} />
              );
            })}
            {upcoming.length === 0 && <p className="text-sm text-muted-foreground">No upcoming matches yet.</p>}
          </div>
        </div>

        <aside>
          <h2 className="display text-2xl">Leaderboard</h2>
          {leaderboardError && <p className="mt-2 text-sm text-destructive">Could not load leaderboard.</p>}
          <ol className="mt-4 space-y-2 rounded-lg border border-border bg-card/40 p-3">
            {leader.length === 0 && <li className="text-sm text-muted-foreground">No predictions yet.</li>}
            {leader.map((row, i) => (
              <li key={row.user_id} className="flex items-center gap-3 text-sm">
                <span className="w-6 text-muted-foreground">{i + 1}</span>
                {row.avatar_url ? <img src={row.avatar_url} alt="" className="h-7 w-7 rounded-full" />
                  : <div className="grid h-7 w-7 place-items-center rounded-full bg-primary/20 text-xs">{row.display_name.slice(0, 1)}</div>}
                <span className="flex-1 truncate">{row.display_name}</span>
                <span className="font-bold text-primary">{row.points}</span>
              </li>
            ))}
/**
 * Row component for predicting a specific match score.
 */

          </ol>
        </aside>
      </div>
    </div>
  );
}

function PredictRow({ matchId, date, home, away, homeStart, awayStart, disabled, onSave }: {
  matchId: string; date: string; home: string; away: string;
  homeStart: number; awayStart: number; disabled: boolean; onSave: (h: number, a: number) => void;
}) {
  const [h, setH] = useState(homeStart);
  const [a, setA] = useState(awayStart);
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card/40 p-3">
      <div className="flex-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {new Date(date).toLocaleString("en-US", { timeZone: "Asia/Dhaka", weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}
        </p>
        <p className="mt-1 text-sm font-semibold">{home} vs {away}</p>
      </div>
/**
 * Numeric input for score entry.
 */

      <div className="flex items-center gap-2">
        <Score value={h} onChange={setH} /><span className="text-muted-foreground">–</span><Score value={a} onChange={setA} />
        <button disabled={disabled} onClick={() => onSave(h, a)} data-testid={`save-${matchId}`}
          className="ml-2 rounded-md bg-primary px-3 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-40">
          Save
        </button>
      </div>
    </div>
  );
}

function Score({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <input
      type="number" min={0} max={20} value={value}
      onWheel={(e) => (e.target as HTMLInputElement).blur()}
      onChange={(e) => onChange(Math.max(0, Math.min(20, Number(e.target.value) || 0)))}
      className="w-12 rounded-md border border-border bg-input px-2 py-2 text-center text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
    />
  );
}
