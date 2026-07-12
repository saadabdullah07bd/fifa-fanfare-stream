import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Calendar, Trophy, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { bdDate, bdTime } from "@/lib/flags";

type Profile = { favorite_club_name: string | null; favorite_club_logo: string | null };
type Team = { code: string; name: string; group: string | null; confederation: string | null; flag_url: string | null };
type Match = {
  id: string; external_id: string | null; stage: string; group: string | null; date_utc: string;
  home_team_code: string; away_team_code: string;
  home_score: number | null; away_score: number | null;
  status: string; minute: string | null;
};

/**
 * Normalizes match ID for routing, prioritizing external_id without the 'fd_' prefix.
 */
function matchRouteId(m: { external_id: string | null; id: string }) {
  return (m.external_id ?? "").replace(/^fd_/, "") || m.id;
}

/**
 * Retrieves the favorite team code from local storage.
 */
function getFavCode(): string | null {
  try { return window.localStorage.getItem("fav_team_code"); } catch { return null; }
}

/**
 * A dashboard card that displays personalized content for the user's favorite team.
 * Shows upcoming matches, recent results, and group standings.
 */
export default function FavoriteClubCard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [code, setCode] = useState<string | null>(getFavCode());
  const [team, setTeam] = useState<Team | null>(null);
  const [groupTeams, setGroupTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);

  /**
   * Loads user profile from Supabase to get the favorite club details.
   */
  const loadProfile = async () => {
    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user.id;
    if (!uid) { setProfile(null); return; }
    const { data } = await supabase.from("profiles")
      .select("favorite_club_name, favorite_club_logo").eq("id", uid).maybeSingle();
    setProfile(data ?? null);
  };

  useEffect(() => {
    loadProfile();
    // Re-load when favorite club changes via local event or auth state.
    const onChange = () => { setCode(getFavCode()); loadProfile(); };
    window.addEventListener("favorite-club-changed", onChange);
    const { data: sub } = supabase.auth.onAuthStateChange(() => onChange());
    return () => {
      window.removeEventListener("favorite-club-changed", onChange);
      sub.subscription.unsubscribe();
    };
  }, []);

  // Resolve team data by code or name.
  useEffect(() => {
    if (!profile?.favorite_club_name) { setTeam(null); return; }
    setLoading(true);
    (async () => {
      let t: Team | null = null;
      if (code) {
        const { data } = await supabase.from("teams")
          .select("code, name, group, confederation, flag_url").eq("code", code).maybeSingle();
        t = data as Team | null;
      }
      if (!t && profile.favorite_club_name) {
        const { data } = await supabase.from("teams")
          .select("code, name, group, confederation, flag_url")
          .eq("name", profile.favorite_club_name).maybeSingle();
        t = data as Team | null;
        if (t) try { window.localStorage.setItem("fav_team_code", t.code); } catch { /* noop */ }
      }
      setTeam(t);
    })();
  }, [profile?.favorite_club_name, code]);

  // Fetch matches and other teams in the same group.
  useEffect(() => {
    if (!team) { setMatches([]); setGroupTeams([]); setLoading(false); return; }
    (async () => {
      const [mx, gt] = await Promise.all([
        supabase.from("matches")
          .select("id, external_id, stage, group, date_utc, home_team_code, away_team_code, home_score, away_score, status, minute")
          .or(`home_team_code.eq.${team.code},away_team_code.eq.${team.code}`)
          .order("date_utc", { ascending: true }),
        team.group
          ? supabase.from("teams")
              .select("code, name, group, confederation, flag_url")
              .eq("group", team.group).order("name")
          : Promise.resolve({ data: [] as Team[] }),
      ]);
      setMatches((mx.data as Match[]) ?? []);
      setGroupTeams((gt.data as Team[]) ?? []);
      setLoading(false);
    })();
  }, [team]);

  // Categorize matches into upcoming and past.
  const { next, recent } = useMemo(() => {
    const now = Date.now();
    const upcoming = matches.filter((m) => new Date(m.date_utc).getTime() >= now - 3 * 3600_000);
    const past = matches.filter((m) => new Date(m.date_utc).getTime() < now - 3 * 3600_000).reverse();
    return { next: upcoming.slice(0, 3), recent: past.slice(0, 3) };
  }, [matches]);

  if (!profile?.favorite_club_name) return null;

  const flag = profile.favorite_club_logo ?? team?.flag_url ?? undefined;
  const teamsByCode = new Map(groupTeams.map((t) => [t.code, t]));
  const nameFor = (c: string) => teamsByCode.get(c)?.name ?? c;
  const flagFor = (c: string) => teamsByCode.get(c)?.flag_url ?? (team?.code === c ? team.flag_url : null);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card shadow-xl"
    >
      <div className="flex items-center gap-4 border-b border-primary/20 bg-gradient-to-r from-primary/20 to-transparent p-5">
        {flag && (
          <img src={flag} alt="" width={64} height={44} loading="lazy"
            className="h-11 w-16 rounded-sm object-cover shadow-lg" />
        )}
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Your team · World Cup 2026</p>
          <h2 className="display truncate text-2xl tracking-wider sm:text-3xl">{profile.favorite_club_name}</h2>
          {team && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {team.group ? `Group ${team.group}` : "Play-off / Intercontinental"}
              {team.confederation && ` · ${team.confederation}`}
            </p>
          )}
        </div>
      </div>

      {loading && <p className="p-5 text-sm text-muted-foreground">Loading team feed…</p>}

      {!loading && (
        <div className="grid gap-5 p-5 md:grid-cols-[1.4fr_1fr]">
          {/* Fixtures list */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary">
              <Calendar className="h-3 w-3" /> Upcoming
            </p>
            {next.length === 0 ? (
              <p className="text-sm text-muted-foreground">No fixtures scheduled yet.</p>
            ) : (
              <ul className="space-y-2">
                {next.map((m) => (
                  <li key={m.id}>
                    <Link to={`/match/${matchRouteId(m)}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background/50 px-3 py-2 text-sm transition hover:border-primary">
                      <div className="flex min-w-0 items-center gap-2">
                        {flagFor(m.home_team_code) && <img src={flagFor(m.home_team_code)!} alt="" className="h-4 w-6 rounded-sm object-cover" />}
                        <span className="truncate font-medium">{nameFor(m.home_team_code)}</span>
                      </div>
                      <span className="display text-primary">vs</span>
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium">{nameFor(m.away_team_code)}</span>
                        {flagFor(m.away_team_code) && <img src={flagFor(m.away_team_code)!} alt="" className="h-4 w-6 rounded-sm object-cover" />}
                      </div>
                      <span className="ml-2 whitespace-nowrap text-[10px] uppercase tracking-widest text-muted-foreground">
                        {bdDate(m.date_utc)} · {bdTime(m.date_utc)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {recent.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                  <Trophy className="h-3 w-3" /> Recent
                </p>
                <ul className="space-y-1.5">
                  {recent.map((m) => (
                    <li key={m.id} className="flex items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-2 text-xs">
                      <span className="truncate">{nameFor(m.home_team_code)}</span>
                      <span className="mx-3 font-bold tabular-nums text-primary">
                        {m.home_score ?? "–"} : {m.away_score ?? "–"}
                      </span>
                      <span className="truncate text-right">{nameFor(m.away_team_code)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Group standings summary */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary">
              <Users className="h-3 w-3" /> {team?.group ? `Group ${team.group}` : "Group"}
            </p>
            {groupTeams.length === 0 ? (
              <p className="text-sm text-muted-foreground">No group assigned.</p>
            ) : (
              <ul className="space-y-1">
                {groupTeams.map((g) => (
                  <li key={g.code}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${
                      g.code === team?.code
                        ? "border-primary/60 bg-primary/10 font-bold"
                        : "border-border/60 bg-background/40"
                    }`}>
                    {g.flag_url && <img src={g.flag_url} alt="" className="h-4 w-6 rounded-sm object-cover" />}
                    <span className="flex-1 truncate">{g.name}</span>
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{g.code}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/standings"
              className="mt-3 block rounded-md border border-border bg-background/40 py-2 text-center text-[10px] uppercase tracking-widest text-muted-foreground hover:text-primary">
              View full standings →
            </Link>
          </div>
        </div>
      )}
    </motion.section>
  );
}
