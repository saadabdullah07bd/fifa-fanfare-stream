import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getTeams } from "@/lib/data.functions";
import { listFavorites, toggleFavorite } from "@/lib/user.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/favorites")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Favorites — Pitch26" },
      { name: "description", content: "Follow your favorite teams at the FIFA World Cup 2026." },
    ],
  }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => { supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session)); }, []);

  const teamsFn = useServerFn(getTeams);
  const favFn = useServerFn(listFavorites);
  const toggleFn = useServerFn(toggleFavorite);

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => teamsFn() });
  const { data: favs = [], refetch } = useQuery({ queryKey: ["favs"], queryFn: () => favFn(), enabled: !!authed });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="display text-5xl">Favorite teams</h1>
      <p className="mt-2 text-muted-foreground">Tap the star to follow. We'll surface their next matches on your home page.</p>

      {authed === false && (
        <div className="mt-6 rounded-lg border border-border bg-card/40 p-4 text-sm">
          <Link to="/auth" className="text-primary underline">Sign in with Google</Link> to save favorites.
        </div>
      )}

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {teams.map((t) => {
          const isFav = favs.includes(t.code);
          return (
            <button
              key={t.code}
              disabled={!authed}
              onClick={async () => {
                try {
                  await toggleFn({ data: { teamCode: t.code } });
                  await refetch();
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
              className={`group relative rounded-lg border p-3 text-left transition ${
                isFav ? "border-primary bg-primary/10" : "border-border bg-card/40 hover:border-primary/60"
              } disabled:opacity-60`}
            >
              <span className={`absolute right-2 top-2 text-lg ${isFav ? "text-primary" : "text-muted-foreground"}`}>
                {isFav ? "★" : "☆"}
              </span>
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
