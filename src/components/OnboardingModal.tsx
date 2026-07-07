import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type ClubHit = { id: number; name: string; country: string; logo: string; venue?: string };

export default function OnboardingModal() {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ClubHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  // Show the modal after login when the profile has no favourite club yet.
  useEffect(() => {
    const check = async (uid: string) => {
      const { data } = await supabase
        .from("profiles")
        .select("favorite_club_id, onboarded_at")
        .eq("id", uid)
        .maybeSingle();
      if (!data?.favorite_club_id && !data?.onboarded_at) setOpen(true);
    };
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id ?? null;
      setUserId(uid);
      if (uid) check(uid);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      const uid = s?.user.id ?? null;
      setUserId(uid);
      if (uid) check(uid);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Debounced club search
  useEffect(() => {
    if (q.trim().length < 3) { setHits([]); return; }
    const t = window.setTimeout(async () => {
      setBusy(true);
      const { data, error } = await supabase.functions.invoke("club", {
        body: { action: "search", q: q.trim() },
      });
      setBusy(false);
      if (error) return;
      setHits(((data as { teams?: ClubHit[] })?.teams ?? []));
    }, 350);
    return () => window.clearTimeout(t);
  }, [q]);

  const pick = async (c: ClubHit) => {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      favorite_club_id: c.id,
      favorite_club_name: c.name,
      favorite_club_logo: c.logo,
      onboarded_at: new Date().toISOString(),
    }).eq("id", userId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Favourite set to ${c.name}`);
    setOpen(false);
    // Nudge Home to re-fetch
    window.dispatchEvent(new CustomEvent("favorite-club-changed"));
  };

  const skip = async () => {
    if (userId) {
      await supabase.from("profiles").update({ onboarded_at: new Date().toISOString() }).eq("id", userId);
    }
    setOpen(false);
  };

  const suggestions = useMemo(
    () => ["Real Madrid", "Barcelona", "Manchester City", "Liverpool", "Bayern Munich", "PSG", "Inter", "Arsenal"],
    [],
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/70 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ y: 24, opacity: 0, scale: 0.96 }} animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", damping: 22, stiffness: 260 }}
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-primary/30 bg-card shadow-2xl"
          >
            <div className="relative bg-gradient-to-br from-primary/25 via-accent/15 to-transparent p-6">
              <button onClick={skip} aria-label="Close"
                className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-foreground/70 hover:bg-background/40 hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
                <Sparkles className="h-3.5 w-3.5" /> Personalise your feed
              </div>
              <h2 className="display mt-1 text-3xl tracking-wider">Pick your favourite club</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                We'll surface their upcoming fixtures, squad and news on your homepage.
              </p>
            </div>

            <div className="p-5">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  autoFocus value={q} onChange={(e) => setQ(e.target.value)}
                  placeholder="Search any club worldwide…"
                  className="w-full rounded-lg border border-border bg-background/60 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary"
                />
              </label>

              {q.trim().length < 3 && (
                <div className="mt-4">
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Popular</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {suggestions.map((s) => (
                      <button key={s} onClick={() => setQ(s)}
                        className="rounded-full border border-border bg-background/50 px-3 py-1 text-xs hover:border-primary hover:text-primary">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 max-h-72 space-y-1 overflow-y-auto">
                {busy && <p className="p-3 text-xs text-muted-foreground">Searching…</p>}
                {!busy && q.trim().length >= 3 && hits.length === 0 && (
                  <p className="p-3 text-xs text-muted-foreground">No clubs matched.</p>
                )}
                {hits.map((c) => (
                  <button key={c.id} onClick={() => pick(c)} disabled={saving}
                    className="flex w-full items-center gap-3 rounded-lg border border-transparent p-2 text-left hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50">
                    <img src={c.logo} alt="" width={32} height={32} loading="lazy" className="h-8 w-8 object-contain" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{c.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{c.country}{c.venue ? ` · ${c.venue}` : ""}</p>
                    </div>
                  </button>
                ))}
              </div>

              <button onClick={skip}
                className="mt-4 w-full rounded-md border border-border py-2 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
                Skip for now
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
