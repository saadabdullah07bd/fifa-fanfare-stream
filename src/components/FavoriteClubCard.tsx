import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, MapPin, Users, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Fx = {
  id: number; date: string; status?: string; minute?: number;
  league: { name: string; logo?: string; round?: string };
  home: { name: string; logo?: string };
  away: { name: string; logo?: string };
  goals?: { home: number | null; away: number | null };
};
type Player = { id: number; name: string; position?: string; number?: number; photo?: string; age?: number };
type Overview = {
  team: { id: number; name: string; logo: string; country: string; founded?: number; venue?: { name?: string; city?: string; capacity?: number } } | null;
  upcoming: Fx[]; recent: Fx[]; squad: Player[];
};

export default function FavoriteClubCard() {
  const [profile, setProfile] = useState<{ favorite_club_id: number | null; favorite_club_name: string | null; favorite_club_logo: string | null } | null>(null);
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(false);

  const loadProfile = async () => {
    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user.id;
    if (!uid) { setProfile(null); return; }
    const { data: p } = await supabase.from("profiles")
      .select("favorite_club_id, favorite_club_name, favorite_club_logo").eq("id", uid).maybeSingle();
    setProfile(p ?? null);
  };

  useEffect(() => {
    loadProfile();
    const onChange = () => loadProfile();
    window.addEventListener("favorite-club-changed", onChange);
    const { data: sub } = supabase.auth.onAuthStateChange(() => loadProfile());
    return () => {
      window.removeEventListener("favorite-club-changed", onChange);
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!profile?.favorite_club_id) { setData(null); return; }
    setLoading(true);
    supabase.functions.invoke("club", { body: { action: "overview", teamId: profile.favorite_club_id } })
      .then(({ data }) => setData(data as Overview))
      .finally(() => setLoading(false));
  }, [profile?.favorite_club_id]);

  if (!profile?.favorite_club_id) return null;

  const next = data?.upcoming?.[0];
  const dateFmt = (d: string) => new Date(d).toLocaleString(undefined, {
    weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card shadow-xl"
    >
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-primary/20 bg-gradient-to-r from-primary/20 to-transparent p-5">
        {profile.favorite_club_logo && (
          <img src={profile.favorite_club_logo} alt="" width={56} height={56} loading="lazy"
            className="h-14 w-14 object-contain drop-shadow" />
        )}
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Your club</p>
          <h2 className="display truncate text-2xl tracking-wider sm:text-3xl">
            {profile.favorite_club_name}
          </h2>
          {data?.team && (
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              <span>{data.team.country}</span>
              {data.team.founded && <span>· Est. {data.team.founded}</span>}
              {data.team.venue?.name && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{data.team.venue.name}</span>}
            </p>
          )}
        </div>
      </div>

      {loading && <p className="p-5 text-sm text-muted-foreground">Loading club feed…</p>}

      {!loading && data && (
        <div className="grid gap-5 p-5 md:grid-cols-[1.4fr_1fr]">
          {/* Next match */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary">
              <Calendar className="h-3 w-3" /> Next match
            </p>
            {next ? (
              <div className="rounded-xl border border-border bg-background/50 p-4">
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  {next.league.name}{next.league.round ? ` · ${next.league.round}` : ""}
                </p>
                <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <div className="flex flex-col items-center gap-1 text-center">
                    {next.home.logo && <img src={next.home.logo} alt="" width={40} height={40} loading="lazy" className="h-10 w-10 object-contain" />}
                    <span className="text-sm font-semibold">{next.home.name}</span>
                  </div>
                  <span className="display text-xl text-primary">VS</span>
                  <div className="flex flex-col items-center gap-1 text-center">
                    {next.away.logo && <img src={next.away.logo} alt="" width={40} height={40} loading="lazy" className="h-10 w-10 object-contain" />}
                    <span className="text-sm font-semibold">{next.away.name}</span>
                  </div>
                </div>
                <p className="mt-3 text-center text-xs text-muted-foreground">{dateFmt(next.date)}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No upcoming fixtures scheduled.</p>
            )}

            {/* Recent results */}
            {data.recent.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                  <Trophy className="h-3 w-3" /> Recent results
                </p>
                <ul className="space-y-1.5">
                  {data.recent.slice(0, 3).map((f) => (
                    <li key={f.id} className="flex items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-2 text-xs">
                      <span className="truncate">{f.home.name}</span>
                      <span className="mx-3 font-bold tabular-nums text-primary">
                        {f.goals?.home ?? "–"} : {f.goals?.away ?? "–"}
                      </span>
                      <span className="truncate text-right">{f.away.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Squad */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary">
              <Users className="h-3 w-3" /> Key squad
            </p>
            <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto pr-1">
              {data.squad.slice(0, 12).map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-md border border-border/60 bg-background/40 p-2">
                  {p.photo ? (
                    <img src={p.photo} alt="" width={32} height={32} loading="lazy" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                      {p.number ?? "?"}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">{p.name}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {p.position ?? "—"}{p.number ? ` · #${p.number}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.section>
  );
}
