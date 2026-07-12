import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { Seo } from "@/lib/seo";
import Hls from "hls.js";
import mpegts from "mpegts.js";
import { toast } from "sonner";
import {
  Tv, Play, Pause, Radio,
  Volume2, VolumeX, Maximize, Minimize, Loader2, PictureInPicture2,
  LogOut, RotateCw, Expand, Shrink,
} from "lucide-react";

type Channel = { id: string; category: string; stream_id: string; name: string; logo_url: string | null };

const is4k = (name: string) => /\b(4k|uhd)\b/i.test(name);
const CAT_LABEL: Record<string, string> = { wc2026: "World Cup 2026", cricket: "Cricket" };

/**
 * Live TV streaming page for World Cup and sports channels.
 */

export default function LiveTV() {
  const navigate = useNavigate();
  const { data: channels = [], isLoading, isError, error } = useQuery({
    // Fetch available TV channels from Supabase.
    queryKey: ["channels"],
    queryFn: async () => {
      const { data, error } = await supabase.from("channels").select("*").order("category").order("name");
      if (error) throw new Error(error.message);
      return ((data as Channel[] | null) ?? [])
        .sort((a, b) => (is4k(a.name) ? 1 : 0) - (is4k(b.name) ? 1 : 0) || a.name.localeCompare(b.name));
    },
  });

  // Admin-selected default channel. Falls back to TSN 1 heuristic if unset.
  // Cached for 60s in react-query; the edge function also sets s-maxage=60.
  const { data: defaultStreamId } = useQuery({
    queryKey: ["default-channel"],
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
  const [reloadNonce, setReloadNonce] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // HLS/MPEGTS stream initialization and playback logic.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let rafId = 0;
    const waitForVideo = () =>
      new Promise<HTMLVideoElement>((resolve) => {
        const tick = () => {
          if (cancelled) return;
          if (videoRef.current) resolve(videoRef.current);
          else rafId = requestAnimationFrame(tick);
        };
        tick();
      });
    let hls: Hls | undefined;
    let mts: ReturnType<typeof mpegts.createPlayer> | undefined;
    (async () => {
      const v = await waitForVideo();
      if (cancelled) return;
      const { data, error } = await supabase.functions.invoke("xtream", {
        body: { action: "stream_url", streamId: active.stream_id },
      });
      if (cancelled) return;
      if (error) throw new Error(error.message);
      const { url, type, fallbackUrl } = data as { url: string; type?: "mpegts" | "hls"; fallbackUrl?: string };
      // Default: sound on at 50% (not muted).
      // Default: sound on at 50% (not muted).
      v.muted = false;
      v.volume = 0.5;
      v.removeAttribute("src");
      v.load();
      // Wait until the browser has ~3s of media buffered before starting playback.
      // This avoids the perceived "stuck loading" from a blind setTimeout.
      const MIN_BUFFER_SEC = 3;
      let started = false;
      const startPlay = () => {
        // Try with sound; if the browser blocks unmuted autoplay, fall back to muted.
        v.play().catch(() => {
          v.muted = true;
          v.play().catch(() => toast.error("Tap play to start the live stream."));
        });
      };
      const tryStart = () => {
        if (started) return;
        const b = v.buffered;
        const ahead = b.length ? b.end(b.length - 1) - v.currentTime : 0;
        if (ahead >= MIN_BUFFER_SEC || v.readyState >= 4) {
          started = true;
          startPlay();
        }
      };
      v.addEventListener("progress", tryStart);
      v.addEventListener("canplaythrough", tryStart);
      // Safety net: start after 4s regardless so the user is never stuck.
      const safety = window.setTimeout(() => { started = true; startPlay(); }, 4000);
      const playVideo = () => { window.clearTimeout(safety); tryStart(); };
      if (type === "mpegts" && mpegts.getFeatureList().mseLivePlayback) {
        mts = mpegts.createPlayer(
          { type: "mpegts", isLive: true, url },
          {
            // Buffered playback — trade ~3s of latency for smooth frames.
            enableStashBuffer: true,
            stashInitialSize: 384,          // KB pre-roll before decoding
            liveBufferLatencyChasing: false, // don't skip ahead when buffer grows
            liveSync: false,
            lazyLoad: false,
            autoCleanupSourceBuffer: true,
            autoCleanupMaxBackwardDuration: 30,
            autoCleanupMinBackwardDuration: 15,
          },
        );
        mts.on(mpegts.Events.ERROR, (_event: unknown, detail: unknown) => {
          console.error("Live stream error", detail);
          if (fallbackUrl && Hls.isSupported() && !hls) {
            try { mts?.pause(); mts?.unload(); mts?.detachMediaElement(); mts?.destroy(); } catch { /* ignore */ }
            hls = new Hls({
              enableWorker: true,
              lowLatencyMode: false,
              liveSyncDurationCount: 4,   // ~4 segments (≈8-12s) buffered ahead
              liveMaxLatencyDurationCount: 10,
              maxBufferLength: 30,
              backBufferLength: 30,
            });
            hls.loadSource(fallbackUrl);
            hls.attachMedia(v);
            void playVideo();
            return;
          }
          toast.error("This channel is not sending playable video right now.");
        });
        mts.attachMediaElement(v);
        mts.load();
      } else if (Hls.isSupported() && !url.endsWith(".mp4")) {
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          liveSyncDurationCount: 4,
          liveMaxLatencyDurationCount: 10,
          maxBufferLength: 30,
          backBufferLength: 30,
        });
        hls.on(Hls.Events.ERROR, (_event, hlsData) => {
          console.error("HLS stream error", hlsData);
          if (hlsData.fatal) toast.error("This channel is not sending playable video right now.");
        });
        hls.loadSource(url);
        hls.attachMedia(v);
      } else {
        v.src = url;
      }
      void playVideo();
    })().catch((e) => toast.error((e as Error).message));
    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      hls?.destroy();
      try { mts?.pause(); mts?.unload(); mts?.detachMediaElement(); mts?.destroy(); } catch { /* ignore */ }
    };
  }, [active, reloadNonce]);

  // Featured channel logic — used for the "start watching" hero button and
  // channel selection heuristics. Playback does NOT start until the user
  // explicitly picks a channel (autoplay is intentionally disabled).
  //   1. Admin-selected default (from app_settings)
  //   2. TSN 1 non-4K
  //   3. Any non-4K channel
  //   4. First channel available
  const heroChannel = useMemo(() => {
    if (defaultStreamId) {
      const picked = channels.find((c) => c.stream_id === defaultStreamId);
      if (picked) return picked;
    }
    const tsn1 = channels.find((c) => /\btsn\s*1\b/i.test(c.name) && !is4k(c.name))
      ?? channels.find((c) => /\btsn\s*1\b/i.test(c.name));
    return tsn1 ?? channels.find((c) => !is4k(c.name)) ?? channels[0] ?? null;
  }, [channels, defaultStreamId]);

  const rows = useMemo(() => {
    const cats = Array.from(new Set(channels.map((c) => c.category))).sort();
    const groups: { title: string; items: Channel[] }[] = [];
    for (const cat of cats) {
      const items = channels.filter((c) => c.category === cat);
      if (items.length) groups.push({ title: CAT_LABEL[cat] ?? cat, items });
    }
    return groups;
  }, [channels]);

  const play = (c: Channel) => {
    setActive(c);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  };

  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");

  const catOptions = useMemo(() => {
    const cats = Array.from(new Set(channels.map((c) => c.category))).sort();
    return [{ key: "all", label: "All channels", count: channels.length }, ...cats.map((c) => ({
      key: c,
      label: CAT_LABEL[c] ?? c,
      count: channels.filter((ch) => ch.category === c).length,
    }))];
  }, [channels]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => activeCat === "all" || (CAT_LABEL[activeCat] ?? activeCat) === r.title)
      .map((r) => ({
        ...r,
        items: q ? r.items.filter((c) => c.name.toLowerCase().includes(q)) : r.items,
      }))
      .filter((r) => r.items.length > 0);
  }, [rows, activeCat, query]);

  const totalVisible = filteredRows.reduce((n, r) => n + r.items.length, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
      className="mx-auto max-w-7xl space-y-6 px-4 py-6 pb-16 sm:space-y-8 sm:py-8"
    >
      <Seo title="Watch World Cup 2026 Live Free in HD & 4K — Semifinals & Final | Pitch26" description="Live stream FIFA World Cup 2026 matches free in HD and 4K UHD — semifinals, final and every group-stage game. No signup, plays instantly on any device." path="/live-tv" />

      {/* Editorial header */}
      <header className="relative overflow-hidden rounded-3xl border border-border bg-card/60 p-5 sm:p-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(60% 80% at 100% 0%, hsl(var(--primary) / 0.18), transparent 60%), radial-gradient(50% 70% at 0% 100%, hsl(var(--trophy-green,142 55% 27%) / 0.25), transparent 60%)",
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
            <h1 className="display mt-2 text-4xl leading-none sm:text-6xl md:text-7xl">Watch Live</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Every match in HD &amp; 4K UHD. Pick a channel to start streaming instantly.
            </p>
          </div>
          <div className="w-full sm:w-72">
            <label htmlFor="channel-search" className="sr-only">Search channels</label>
            <input
              id="channel-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search channels…"
              className="h-11 w-full rounded-full border border-border bg-background/70 px-4 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>
        </div>

        {catOptions.length > 1 && (
          <nav aria-label="Filter by category" className="relative mt-5 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {catOptions.map((c) => {
              const on = activeCat === c.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setActiveCat(c.key)}
                  aria-pressed={on}
                  className={`shrink-0 rounded-full border px-4 py-2 text-xs uppercase tracking-[0.18em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background/50 text-muted-foreground hover:border-primary/60 hover:text-foreground"
                  }`}
                >
                  {c.label}
                  <span className={`ml-1.5 tabular-nums ${on ? "text-primary-foreground/80" : "text-muted-foreground/70"}`}>{c.count}</span>
                </button>
              );
            })}
          </nav>
        )}
      </header>

      <AnimatePresence mode="wait">
        {active ? (
          <motion.div key="player"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          >
            <ModernPlayer videoRef={videoRef} channel={active} onClose={() => setActive(null)} onReload={() => setReloadNonce((n) => n + 1)} />
          </motion.div>
        ) : isLoading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="grid aspect-video place-items-center rounded-3xl border border-primary/30 bg-black"
            role="status" aria-live="polite"
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
                  "radial-gradient(50% 60% at 50% 40%, hsl(var(--primary) / 0.18), transparent 70%)",
              }}
            />
            <div className="relative flex flex-col items-center px-6">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/40">
                <Tv className="h-7 w-7 text-primary" aria-hidden="true" />
              </span>
              <h2 className="display mt-4 text-2xl sm:text-3xl">Pick a channel to start watching</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {channels.length} channel{channels.length === 1 ? "" : "s"} available · autoplay is off
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" role="status" aria-live="polite">
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
      ) : totalVisible === 0 ? (
        <div className="rounded-3xl border border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">
          No channels match your search.
        </div>
      ) : (
        <div className="space-y-10">
          {filteredRows.map((row) => (
            <ChannelRow key={row.title} title={row.title} items={row.items} onPlay={play} activeId={active?.id ?? null} />
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
  title, items, onPlay, activeId,
}: { title: string; items: Channel[]; onPlay: (c: Channel) => void; activeId: string | null }) {
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
          <ChannelCard key={title + c.id} channel={c} onPlay={onPlay} isActive={activeId === c.id} />
        ))}
      </div>
    </section>
  );
}

function ChannelCard({ channel: c, onPlay, isActive }: { channel: Channel; onPlay: (c: Channel) => void; isActive: boolean }) {
  const catLabel = CAT_LABEL[c.category] ?? c.category;
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
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
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

        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 backdrop-blur-[1px] transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
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
/**
 * Custom video player component with controls and fullscreen support.
 */

  // HLS/MPEGTS stream initialization and playback logic.
  useEffect(() => { setOk(!!url); }, [url]);
  const initials = name
    .replace(/\(.*?\)|\[.*?\]/g, "")
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "").join("");
  if (!ok || !url) {
    return (
      <div className="grid h-full w-full place-items-center">
        <span className="display text-2xl tracking-widest text-primary/80">{initials || "TV"}</span>
      </div>
    );
  }
  return (
    <img
      src={url} alt={name} loading="lazy" onError={() => setOk(false)}
      className="max-h-[85%] max-w-[85%] object-contain drop-shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
    />
  );
}

function ModernPlayer({
  videoRef, channel, onClose, onReload,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  channel: Channel;
  onClose: () => void;
  onReload: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [fill, setFill] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [buffering, setBuffering] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [showUI, setShowUI] = useState(true);
  const hideTimer = useRef<number | null>(null);

  // HLS/MPEGTS stream initialization and playback logic.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => setBuffering(false);
    const onVolume = () => { setMuted(v.muted); setVolume(v.volume); };
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("waiting", onWaiting);
    v.addEventListener("playing", onPlaying);
    v.addEventListener("volumechange", onVolume);
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("waiting", onWaiting);
      v.removeEventListener("playing", onPlaying);
      v.removeEventListener("volumechange", onVolume);
    };
  }, [videoRef, channel.id]);

  // HLS/MPEGTS stream initialization and playback logic.
  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const kick = () => {
    setShowUI(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setShowUI(false), 2600);
  };
  // HLS/MPEGTS stream initialization and playback logic.
  useEffect(() => { kick(); return () => { if (hideTimer.current) window.clearTimeout(hideTimer.current); }; }, [channel.id]);

  const toggle = () => {
    const v = videoRef.current; if (!v) return;
    if (v.paused) v.play(); else v.pause();
  };
  const toggleMute = () => { const v = videoRef.current; if (v) v.muted = !v.muted; };
  const setVol = (val: number) => { const v = videoRef.current; if (v) { v.volume = val; v.muted = val === 0; } };
  const toggleFs = async () => {
    if (!wrapRef.current) return;
    if (document.fullscreenElement) {
      try { (screen.orientation as any)?.unlock?.(); } catch { /* ignore */ }
      await document.exitFullscreen();
    } else {
      await wrapRef.current.requestFullscreen();
      // Force landscape on mobile devices for better viewing.
      const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
      if (isMobile) {
        try { await (screen.orientation as any)?.lock?.("landscape"); } catch { /* not supported */ }
      }
    }
  };
  const togglePip = async () => {
    const v = videoRef.current as any; if (!v) return;
    try {
      if ((document as any).pictureInPictureElement) await (document as any).exitPictureInPicture();
      else await v.requestPictureInPicture();
    } catch { /* not supported */ }
  };

  // Keyboard shortcuts (Space/K play, M mute, F fullscreen, arrows volume/seek, Esc close)
  // HLS/MPEGTS stream initialization and playback logic.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const v = videoRef.current; if (!v) return;
      switch (e.key.toLowerCase()) {
        case " ":
        case "k": e.preventDefault(); toggle(); kick(); break;
        case "m": e.preventDefault(); v.muted = !v.muted; kick(); break;
        case "f": e.preventDefault(); toggleFs(); kick(); break;
        case "p": e.preventDefault(); togglePip(); kick(); break;
        case "arrowup": e.preventDefault(); setVol(Math.min(1, v.volume + 0.1)); kick(); break;
        case "arrowdown": e.preventDefault(); setVol(Math.max(0, v.volume - 0.1)); kick(); break;
        case "arrowright": e.preventDefault(); try { v.currentTime += 10; } catch { /* live */ } kick(); break;
        case "arrowleft": e.preventDefault(); try { v.currentTime -= 10; } catch { /* live */ } kick(); break;
        case "escape": if (!document.fullscreenElement) onClose(); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.id]);

  const isMobile = useIsMobile();

  // Right-side vertical drag = volume rocker (mobile).
  const dragRef = useRef<{ startY: number; startVol: number } | null>(null);
  const [volPill, setVolPill] = useState<number | null>(null);
  const volPillTimer = useRef<number | null>(null);
  const onVolTouchStart = (e: React.TouchEvent) => {
    const v = videoRef.current; if (!v) return;
    dragRef.current = { startY: e.touches[0].clientY, startVol: v.muted ? 0 : v.volume };
    kick();
  };
  const onVolTouchMove = (e: React.TouchEvent) => {
    const v = videoRef.current; const d = dragRef.current;
    if (!v || !d || !wrapRef.current) return;
    const h = wrapRef.current.clientHeight || 1;
    const dy = d.startY - e.touches[0].clientY; // up = positive
    const next = Math.max(0, Math.min(1, d.startVol + dy / h));
    v.volume = next;
    v.muted = next === 0;
    setVolPill(next);
    if (volPillTimer.current) window.clearTimeout(volPillTimer.current);
    volPillTimer.current = window.setTimeout(() => setVolPill(null), 700);
    e.preventDefault();
  };
  const onVolTouchEnd = () => { dragRef.current = null; };

  return (
    <div
      ref={wrapRef}
      onMouseMove={kick}
      onTouchStart={kick}
      style={{ cursor: showUI ? "" : "none" }}
      className="live-player group relative overflow-hidden rounded-2xl border border-primary/30 bg-black shadow-[0_30px_80px_-20px_hsl(var(--primary)/0.35)] outline-none focus:outline-none focus-visible:outline-none [&:fullscreen]:h-screen [&:fullscreen]:w-screen [&:fullscreen]:rounded-none [&:fullscreen]:border-0 [&:fullscreen]:shadow-none"
      tabIndex={-1}
    >
      <video
        ref={videoRef}
        playsInline
        controlsList="nodownload noremoteplayback noplaybackrate"
        disablePictureInPicture={false}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => { kick(); }}
        style={{ cursor: showUI ? "pointer" : "none" }}
        className={`aspect-video h-full w-full bg-black outline-none focus:outline-none focus-visible:outline-none group-[:fullscreen]:h-full ${fill ? "object-cover group-[:fullscreen]:object-cover" : "object-contain group-[:fullscreen]:object-contain"}`}
      />

      {/* Right-side vertical volume rocker (mobile only). Purely a gesture
          surface — decorative, not a labeled interactive element. */}
      {isMobile && (
        <div
          onTouchStart={onVolTouchStart}
          onTouchMove={onVolTouchMove}
          onTouchEnd={onVolTouchEnd}
          className="absolute right-0 top-20 bottom-24 z-10 w-24"
          style={{ touchAction: "none" }}
          aria-hidden="true"
        />
      )}

      <AnimatePresence>
        {volPill !== null && (
          <motion.div
            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
            className="pointer-events-none absolute right-4 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/70 px-3 py-2 text-xs font-bold text-white backdrop-blur"
          >
            {Math.round(volPill * 100)}%
          </motion.div>
        )}
      </AnimatePresence>


      <AnimatePresence>
        {buffering && (
          <motion.div key="buf" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 grid place-items-center bg-black/30 backdrop-blur-[2px]"
          >
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showUI && (
          <motion.div key="top"
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 bg-gradient-to-b from-black/85 via-black/40 to-transparent p-3 sm:p-4"
          >
            <div className="pointer-events-auto flex min-w-0 items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-lg">
                <span className="live-dot" aria-hidden="true" /> Live
              </span>
              <div className="min-w-0">
                <p className="display truncate text-base leading-tight text-white sm:text-lg" title={channel.name}>
                  {channel.name}
                </p>
                <p className="truncate text-[10px] uppercase tracking-[0.2em] text-white/60">
                  {CAT_LABEL[channel.category] ?? channel.category}
                </p>
              </div>
              {is4k(channel.name) && (
                <span className="hidden rounded bg-gradient-to-r from-amber-400 to-orange-500 px-2 py-0.5 text-[10px] font-black tracking-wider text-black sm:inline-block">
                  4K UHD
                </span>
              )}
            </div>

            <div className="pointer-events-auto flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                title="Close player (Esc)"
                aria-label="Close player"
                className="inline-flex h-10 min-w-10 items-center gap-1.5 rounded-full bg-white/10 px-3 text-xs font-semibold uppercase tracking-wider text-white backdrop-blur-sm transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:h-9"
              >
                <LogOut className="h-4 w-4 rotate-180" aria-hidden="true" />
                <span className="hidden sm:inline">Change channel</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!playing && !buffering && (
          <motion.button key="center"
            initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
            onClick={toggle}
            className="absolute inset-0 m-auto grid h-20 w-20 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_0_0_8px_hsl(var(--primary)/0.15),0_20px_60px_-10px_hsl(var(--primary)/0.6)] transition hover:scale-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/40"
            aria-label="Play"
          >
            <Play className="h-9 w-9 fill-current" aria-hidden="true" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showUI && (
          <motion.div key="bot"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 sm:p-4"
          >
            <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 p-1 backdrop-blur-md sm:gap-2 sm:p-1.5">
              <PlayerBtn onClick={toggle} label={playing ? "Pause (K)" : "Play (K)"} title={playing ? "Pause (K)" : "Play (K)"}>
                {playing ? <Pause className="h-4 w-4 fill-current" aria-hidden="true" /> : <Play className="h-4 w-4 fill-current" aria-hidden="true" />}
              </PlayerBtn>
              <PlayerBtn onClick={toggleMute} label={muted ? "Unmute (M)" : "Mute (M)"} title={muted ? "Unmute (M)" : "Mute (M)"}>
                {muted || volume === 0 ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
              </PlayerBtn>
              {(() => {
                const v = muted ? 0 : volume;
                const pct = Math.round(v * 100);
                return (
                  <div className="volume-slider group/vol hidden items-center pl-1 pr-2 sm:flex">
                    <input
                      type="range" min={0} max={1} step={0.01}
                      value={v}
                      onChange={(e) => setVol(parseFloat(e.target.value))}
                      style={{ ["--vol" as any]: `${pct}%` }}
                      className="modern-range h-1.5 w-20 cursor-pointer appearance-none rounded-full transition-all group-hover/vol:w-32 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      aria-label="Volume"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={pct}
                    />
                  </div>
                );
              })()}

              <span aria-hidden="true" className="mx-1 hidden h-5 w-px bg-white/10 sm:block" />

              <span className="hidden items-center gap-1.5 rounded-full bg-destructive/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white sm:inline-flex">
                <span className="live-dot" aria-hidden="true" /> Live
              </span>

              <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
                <PlayerBtn onClick={() => { toast.message("Reloading stream…"); onReload(); kick(); }} label="Reload stream" title="Reload stream">
                  <RotateCw className="h-4 w-4" aria-hidden="true" />
                </PlayerBtn>
                <PlayerBtn
                  onClick={() => { setFill((f) => !f); kick(); }}
                  label={fill ? "Fit to screen" : "Fill screen"}
                  title={fill ? "Fit to screen" : "Fill screen"}
                  active={fill}
                >
                  {fill ? <Shrink className="h-4 w-4" aria-hidden="true" /> : <Expand className="h-4 w-4" aria-hidden="true" />}
                </PlayerBtn>
                <PlayerBtn onClick={togglePip} label="Picture in picture (P)" title="Picture in picture (P)" className="hidden sm:grid">
                  <PictureInPicture2 className="h-4 w-4" aria-hidden="true" />
                </PlayerBtn>
                <PlayerBtn onClick={toggleFs} label={fullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"} title={fullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"}>
                  {fullscreen ? <Minimize className="h-4 w-4" aria-hidden="true" /> : <Maximize className="h-4 w-4" aria-hidden="true" />}
                </PlayerBtn>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PlayerBtn({
  children,
  onClick,
  label,
  title,
  active,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  title?: string;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={title ?? label}
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-white transition hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        active ? "bg-primary/80" : "bg-white/5"
      } ${className}`}
    >
      {children}
    </button>
  );
}

}
