import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Seo } from "@/lib/seo";
import { toast } from "sonner";

export default function Favorites() {
  const { user, ready } = useAuth();
  const qc = useQueryClient();

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => (await supabase.from("teams").select("*").order("name")).data ?? [],
  });
  const { data: favs = [] } = useQuery({
    queryKey: ["favs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("favorites").select("team_code").eq("user_id", user!.id);
      return (data ?? []).map((f) => f.team_code);
    },
  });

  async function toggle(code: string) {
    if (!user) return;
    const isFav = favs.includes(code);
    if (isFav) {
      const { error } = await supabase.from("favorites").delete().eq("user_id", user.id).eq("team_code", code);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("favorites").insert({ user_id: user.id, team_code: code });
      if (error) return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["favs", user.id] });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Seo title="Favorites — Pitch26" description="Follow your favorite teams at the FIFA World Cup 2026." />
      <h1 className="display text-5xl">Favorite teams</h1>
      <p className="mt-2 text-muted-foreground">Tap the star to follow.</p>

      {ready && !user && (
        <div className="mt-6 rounded-lg border border-border bg-card/40 p-4 text-sm">
          <Link to="/auth" className="text-primary underline">Sign in with Google</Link> to save favorites.
        </div>
      )}

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {teams.map((t) => {
          const isFav = favs.includes(t.code);
          return (
            <button key={t.code} disabled={!user} onClick={() => toggle(t.code)}
              className={`group relative rounded-lg border p-3 text-left transition ${
                isFav ? "border-primary bg-primary/10" : "border-border bg-card/40 hover:border-primary/60"
              } disabled:opacity-60`}>
              <span className={`absolute right-2 top-2 text-lg ${isFav ? "text-primary" : "text-muted-foreground"}`}>{isFav ? "★" : "☆"}</span>
              {t.flag_url && <img src={t.flag_url} alt="" className="mb-2 h-10 w-10 rounded object-contain" />}
              <p className="text-sm font-bold">{t.name}</p>
              <p className="text-xs text-muted-foreground">{t.group ? `Group ${t.group}` : t.confederation}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
