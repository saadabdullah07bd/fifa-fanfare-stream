import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type WcTeam = {
  code: string;
  name: string;
  group: string | null;
  confederation: string | null;
  flag_url: string | null;
};

/**
 * An onboarding modal that asks new users to select their favorite World Cup 2026 team.
 * This selection personalizes their dashboard feed.
 */
export default function OnboardingModal() {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [teams, setTeams] = useState<WcTeam[]>([]);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);

  // Checks if the user has already onboarded or picked a favorite club.
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

  // Preload the list of 48 teams when the modal is opened.
  useEffect(() => {
    if (!open || teams.length) return;
    supabase
      .from("teams")
      .select("code, name, group, confederation, flag_url")
      .order("group", { ascending: true, nullsFirst: false })
      .order("name")
      .then(({ data }) => setTeams((data as WcTeam[]) ?? []));
  }, [open, teams.length]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return teams;
    return teams.filter(
      (t) => t.name.toLowerCase().includes(s) || t.code.toLowerCase().includes(s),
    );
  }, [teams, q]);

  const grouped = useMemo(() => {
    const map = new Map<string, WcTeam[]>();
    for (const t of filtered) {
      const k = t.group ? `Group ${t.group}` : "Play-off / Intercontinental";
      const arr = map.get(k) ?? [];
      arr.push(t);
      map.set(k, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  /**
   * Saves the user's favorite team selection to their profile in Supabase.
   *
   * @param t - The team object selected by the user.
   */
  const pick = async (t: WcTeam) => {
    if (!userId) return;
    setSaving(true);
    // Generate a stable numeric ID from the team code for legacy profile columns.
    const idNum = Math.abs(
      [...t.code].reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 5381),
    );
    const { error } = await supabase
      .from("profiles")
      .update({
        favorite_club_id: idNum,
        favorite_club_name: t.name,
        favorite_club_logo: t.flag_url,
        onboarded_at: new Date().toISOString(),
      })
      .eq("id", userId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    // Cache the team code locally for immediate UI updates.
    try {
      window.localStorage.setItem("fav_team_code", t.code);
    } catch {
      /* noop */
    }
    toast.success(`Backing ${t.name} for 2026 🇺🇳`);
    setOpen(false);
    window.dispatchEvent(new CustomEvent("favorite-club-changed"));
  };

  /**
   * Marks the user as onboarded without selecting a favorite team.
   */
  const skip = async () => {
    if (userId) {
      await supabase
        .from("profiles")
        .update({ onboarded_at: new Date().toISOString() })
        .eq("id", userId);
    }
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/70 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ y: 24, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", damping: 22, stiffness: 260 }}
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-primary/30 bg-card shadow-2xl"
          >
            <div className="relative bg-gradient-to-br from-primary/25 via-accent/15 to-transparent p-6">
              <button
                onClick={skip}
                aria-label="Close"
                className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-foreground/70 hover:bg-background/40 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
                <Sparkles className="h-3.5 w-3.5" /> Personalise your feed
              </div>
              <h2 className="display mt-1 text-3xl tracking-wider sm:text-4xl">
                Who are you backing?
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Pick your World Cup 2026 team — we'll surface their fixtures, results and group
                table on your homepage.
              </p>
            </div>

            <div className="p-5">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search country…"
                  className="w-full rounded-lg border border-border bg-background/60 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary"
                />
              </label>

              <div className="mt-4 max-h-[26rem] space-y-4 overflow-y-auto pr-1">
                {teams.length === 0 && (
                  <p className="p-3 text-xs text-muted-foreground">Loading teams…</p>
                )}
                {grouped.map(([label, ts]) => (
                  <div key={label}>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-primary">
                      {label}
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {ts.map((t) => (
                        <button
                          key={t.code}
                          onClick={() => pick(t)}
                          disabled={saving}
                          className="group flex items-center gap-2 rounded-lg border border-border bg-background/40 p-2 text-left transition hover:-translate-y-0.5 hover:border-primary hover:bg-primary/5 disabled:opacity-50"
                        >
                          {t.flag_url ? (
                            <img
                              src={t.flag_url}
                              alt=""
                              width={28}
                              height={20}
                              loading="lazy"
                              className="h-5 w-7 rounded-sm object-cover shadow"
                            />
                          ) : (
                            <span className="grid h-5 w-7 place-items-center rounded-sm bg-muted text-[9px] font-bold">
                              {t.code}
                            </span>
                          )}
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold group-hover:text-primary">
                            {t.name}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            {t.code}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && teams.length > 0 && (
                  <p className="p-3 text-xs text-muted-foreground">No country matched "{q}".</p>
                )}
              </div>

              <button
                onClick={skip}
                className="mt-4 w-full rounded-md border border-border py-2 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
              >
                Skip for now
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
