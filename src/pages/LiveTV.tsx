import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/lib/seo";
import LivePlayer, { categoryLabel, is4k, type Channel } from "@/components/LivePlayer";
import { Tv, Play, Radio, Loader2, LogOut } from "lucide-react";

/**
 * Live TV streaming page for World Cup and beIN sports channels. Playback
 * itself lives entirely in <LivePlayer/>; this page owns the catalogue.
 */
export default function LiveTV() {
  const navigate = useNavigate();
  const {
    data: channels = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    // Fetch available TV channels from Supabase. Always revalidate on mount:
    // the query cache is persisted to localStorage for 24h and the global
    // defaults disable mount/focus refetching, so without this the page kept
    // showing a stale catalogue after the channel list changed server-side.
    queryKey: ["channels"],
    staleTime: 60_000,
    refetchOnMount: "always",
    queryFn: async () => {
      // Explicit columns, not "*": `direct_url` can embed upstream Xtream
      // credentials and is revoked from anon/authenticated, so "*" would fail.
      const { data, error } = await supabase
        .from("channels")
        .select("id, category, stream_id, name, logo_url")
        .order("category")
        .order("name");
      if (error) throw new Error(error.message);
      return ((data as Channel[] | null) ?? []).sort(
        (a, b) => (is4k(a.name) ? 1 : 0) - (is4k(b.name) ? 1 : 0) || a.name.localeCompare(b.name),
      );
    },
  });

  // Admin-selected default channel. Falls back to a beIN/WC heuristic if unset.
  const { data: defaultStreamId } = useQuery({
    queryKey: ["default-channel"],
    refetchOnMount: "always",
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("default_stream_id")
        .eq("id", 1)
        .maybeSingle();
      return (data?.default_stream_id as string | null) ?? null;
    },
    staleTime: 60_000,
  });

  const [active, setActive] = useState<Channel | null>(null);

  const groups = useMemo(() => {
    const order = ["wc2026", "bein", "other"];
    const map = new Map<string, Channel[]>();
    for (const c of channels) {
      const key = c.category || "other";
      const arr = map.get(key) ?? [];
      arr.push(c);
      map.set(key, arr);
    }
    return [...map.entries()].sort(([a], [b]) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }, [channels]);

  // Flat list in the on-screen order, for prev/next channel zapping.
  const flat = useMemo(() => groups.flatMap(([, items]) => items), [groups]);
  const zap = (dir: 1 | -1) => {
    if (!active || flat.length === 0) return;
    const i = flat.findIndex((c) => c.id === active.id);
    const next = flat[(i + dir + flat.length) % flat.length];
    setActive(next);
  };

  // Featured channel — used for the "start watching" hero button. Playback
  // does NOT start until the user explicitly picks a channel.
  //   1. Admin-selected default (from app_settings)
  //   2. beIN non-4K, then World Cup non-4K, then any non-4K
  //   3. First channel available
  const heroChannel = useMemo(() => {
    if (defaultStreamId) {
      const picked = channels.find((c) => c.stream_id === defaultStreamId);
      if (picked) return picked;
    }
    const prefer =
      channels.find((c) => /\bbein\b/i.test(c.name) && !is4k(c.name)) ??
      channels.find((c) => /world.?cup|fifa/i.test(c.name) && !is4k(c.name)) ??
      channels.find((c) => !is4k(c.name));
    return prefer ?? channels[0] ?? null;
  }, [channels, defaultStreamId]);

  const play = (c: Channel) => {
    setActive(c);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mx-auto max-w-7xl space-y-6 px-4 py-6 pb-16 sm:space-y-8 sm:py-8"
    >
      <Seo
        title="Watch World Cup 2026 Live Free in HD & 4K — Semifinals & Final | Pitch26"
        description="Live stream FIFA World Cup 2026 matches free in HD and 4K UHD — semifinals, final and every group-stage game. No signup, plays instantly on any device."
        path="/live-tv"
      />

      {/* Editorial header */}
      <header className="hero-sweep relative overflow-hidden rounded-3xl border border-border bg-card/60 p-5 sm:p-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(60% 80% at 100% 0%, rgba(var(--primary-rgb), 0.18), transparent 60%), radial-gradient(50% 70% at 0% 100%, rgba(var(--trophy-green-rgb), 0.25), transparent 60%)",
          }}
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-primary">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              <span>On air · World Cup 2026</span>
            </div>
            <h1 className="display mt-2 text-4xl leading-none sm:text-6xl md:text-7xl">
              Watch Live
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Every match in HD &amp; 4K UHD. Pick a channel to start streaming instantly.
            </p>
          </div>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {active ? (
          <motion.div
            key="player"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <LivePlayer
              channel={active}
              onClose={() => setActive(null)}
              onPrev={() => zap(-1)}
              onNext={() => zap(1)}
            />
          </motion.div>
        ) : isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid aspect-video place-items-center rounded-3xl border border-primary/30 bg-black"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="h-12 w-12 animate-spin text-primary" aria-hidden="true" />
            <span className="sr-only">Loading channels…</span>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative flex aspect-video flex-col items-center justify-center overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-black via-background to-card text-center"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-60"
              style={{
                background:
                  "radial-gradient(50% 60% at 50% 40%, rgba(var(--primary-rgb), 0.18), transparent 70%)",
              }}
            />
            <div className="relative flex flex-col items-center px-6">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/40">
                <Tv className="h-7 w-7 text-primary" aria-hidden="true" />
              </span>
              <h2 className="display mt-4 text-2xl sm:text-3xl">
                Pick a channel to start watching
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {channels.length} channel{channels.length === 1 ? "" : "s"} available · autoplay is
                off
              </p>
              {heroChannel && (
                <button
                  type="button"
                  onClick={() => play(heroChannel)}
                  className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold uppercase tracking-wider text-primary-foreground shadow-lg transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                  Start with {heroChannel.name}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
          role="status"
          aria-live="polite"
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-card/40" />
          ))}
          <span className="sr-only">Loading channels…</span>
        </div>
      ) : isError ? (
        <div className="rounded-3xl border border-destructive/40 bg-destructive/10 p-6 text-center text-sm text-destructive">
          {(error as Error).message || "Could not load channels."}
        </div>
      ) : channels.length === 0 ? (
        <div className="rounded-3xl border border-border bg-card/40 p-6 text-sm text-muted-foreground">
          No channels yet. The site admin needs to connect the Xtream server from Settings.
        </div>
      ) : (
        <div className="space-y-10">
          {groups.map(([cat, items]) => (
            <ChannelRow
              key={cat}
              title={categoryLabel(cat)}
              items={items}
              onPlay={play}
              activeId={active?.id ?? null}
            />
          ))}
        </div>
      )}

      <div className="mt-8 flex justify-center border-t border-border/50 pt-8">
        <button
          onClick={signOut}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-secondary px-5 py-2.5 text-sm font-semibold uppercase tracking-wider transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
        </button>
      </div>
    </motion.div>
  );
}

function ChannelRow({
  title,
  items,
  onPlay,
  activeId,
}: {
  title: string;
  items: Channel[];
  onPlay: (c: Channel) => void;
  activeId: string | null;
}) {
  return (
    <section className="space-y-4" aria-label={title}>
      <div className="flex items-baseline justify-between">
        <h3 className="display flex items-center gap-2 text-2xl text-primary sm:text-3xl">
          <span className="inline-block h-5 w-1 rounded bg-primary" aria-hidden="true" />
          {title}
        </h3>
        <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground tabular-nums">
          {items.length} channel{items.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {items.map((c) => (
          <ChannelCard
            key={title + c.id}
            channel={c}
            onPlay={onPlay}
            isActive={activeId === c.id}
          />
        ))}
      </div>
    </section>
  );
}

function ChannelCard({
  channel: c,
  onPlay,
  isActive,
}: {
  channel: Channel;
  onPlay: (c: Channel) => void;
  isActive: boolean;
}) {
  const catLabel = categoryLabel(c.category);
  return (
    <motion.button
      onClick={() => onPlay(c)}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      aria-label={`Play ${c.name}${is4k(c.name) ? " in 4K UHD" : ""} — ${catLabel}`}
      aria-pressed={isActive}
      className={`group relative w-full overflow-hidden rounded-2xl border bg-card/60 text-left shadow-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        isActive ? "border-primary ring-2 ring-primary/50" : "border-border hover:border-primary/60"
      }`}
    >
      <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-gradient-to-br from-secondary/40 via-secondary/20 to-primary/10">
        <ChannelLogo url={c.logo_url} name={c.name} />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent"
        />
        {is4k(c.name) && (
          <span className="absolute bottom-2 right-2 whitespace-nowrap rounded bg-gradient-to-r from-amber-400 to-orange-500 px-1.5 py-0.5 text-[9px] font-black leading-none tracking-wider text-black shadow">
            4K UHD
          </span>
        )}
        {isActive && (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
            <Radio className="h-3 w-3 animate-pulse" aria-hidden="true" /> On
          </span>
        )}

        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 backdrop-blur-[1px] transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          <Play className="h-8 w-8 fill-primary text-primary" />
        </span>
      </div>
      <div className="p-2.5">
        <p className="truncate text-sm font-semibold">{c.name}</p>
        <p className="truncate text-xs uppercase tracking-[0.15em] text-muted-foreground">
          {catLabel}
        </p>
      </div>
    </motion.button>
  );
}

function ChannelLogo({ url, name }: { url: string | null; name: string }) {
  const [ok, setOk] = useState(!!url);
  useEffect(() => {
    setOk(!!url);
  }, [url]);
  const initials = name
    .replace(/\(.*?\)|\[.*?\]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  if (!ok || !url) {
    return (
      <div className="grid h-full w-full place-items-center">
        <span className="display text-2xl tracking-widest text-primary/80">{initials || "TV"}</span>
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={name}
      loading="lazy"
      onError={() => setOk(false)}
      className="max-h-[85%] max-w-[85%] object-contain drop-shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
    />
  );
}
