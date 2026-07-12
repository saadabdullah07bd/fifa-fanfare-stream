import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/lib/seo";
import Hls from "hls.js";
import mpegts from "mpegts.js";
import { toast } from "sonner";
import {
  Search, Tv, Radio, Play, Pause, Sparkles, X, ChevronLeft, ChevronRight,
  Volume2, VolumeX, Maximize, Minimize, Loader2, PictureInPicture2,
  LogOut,
} from "lucide-react";

type Channel = { id: string; category: string; stream_id: string; name: string; logo_url: string | null };

const is4k = (name: string) => /\b(4k|uhd)\b/i.test(name);
const CAT_LABEL: Record<string, string> = { wc2026: "World Cup 2026", cricket: "Cricket" };

export default function LiveTV() {
  const navigate = useNavigate();
  const { data: channels = [], isLoading, isError, error } = useQuery({
    queryKey: ["channels"],
    queryFn: async () => {
      const { data, error } = await supabase.from("channels").select("*").order("category").order("name");
      if (error) throw new Error(error.message);
      return ((data as Channel[] | null) ?? [])
        .sort((a, b) => (is4k(a.name) ? 1 : 0) - (is4k(b.name) ? 1 : 0) || a.name.localeCompare(b.name));
    },
  });

  const [active, setActive] = useState<Channel | null>(null);
  const [autoStarted, setAutoStarted] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!active || !videoRef.current) return;
    let hls: Hls | undefined;
    let mts: ReturnType<typeof mpegts.createPlayer> | undefined;
    (async () => {
      const { data, error } = await supabase.functions.invoke("xtream", {
        body: { action: "stream_url", streamId: active.stream_id },
      });
      if (error) throw new Error(error.message);
      const { url, type, fallbackUrl } = data as { url: string; type?: "mpegts" | "hls"; fallbackUrl?: string };
      const v = videoRef.current!;
      // Default: sound on at 50% (not muted).
      v.muted = false;
      v.volume = 0.5;
      v.removeAttribute("src");
      v.load();
      // Wait until the browser has ~3s of media buffered before starting playback.
      // This avoids the perceived "stuck loading" from a blind setTimeout.
      const MIN_BUFFER_SEC = 3;
      let started = false;
      const tryStart = () => {
        if (started) return;
        const b = v.buffered;
        const ahead = b.length ? b.end(b.length - 1) - v.currentTime : 0;
        if (ahead >= MIN_BUFFER_SEC || v.readyState >= 4) {
          started = true;
          v.play().catch(() => toast.error("Tap play to start the live stream."));
        }
      };
      v.addEventListener("progress", tryStart);
      v.addEventListener("canplaythrough", tryStart);
      // Safety net: start after 4s regardless so the user is never stuck.
      const safety = window.setTimeout(() => { started = true; v.play().catch(() => {}); }, 4000);
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
      hls?.destroy();
      try { mts?.pause(); mts?.unload(); mts?.detachMediaElement(); mts?.destroy(); } catch { /* ignore */ }
    };
  }, [active]);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(channels.map((c) => c.category))).sort()],
    [channels],
  );

  const heroChannel = useMemo(() => {
    // Prefer TSN 1 as the default featured channel.
    const tsn1 = channels.find((c) => /\btsn\s*1\b/i.test(c.name) && !is4k(c.name))
      ?? channels.find((c) => /\btsn\s*1\b/i.test(c.name));
    return tsn1 ?? channels.find((c) => !is4k(c.name)) ?? channels[0] ?? null;
  }, [channels]);

  const filtered = useMemo(
    () =>
      channels.filter(
        (c) =>
          (category === "All" || c.category === category) &&
          c.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [channels, query, category],
  );

  const rows = useMemo(() => {
    const searching = query.trim().length > 0 || category !== "All";
    if (searching) return [{ title: "Results", items: filtered }];
    const groups: { title: string; items: Channel[] }[] = [];
    for (const cat of categories.filter((c) => c !== "All")) {
      const items = channels.filter((c) => c.category === cat);
      if (items.length) groups.push({ title: CAT_LABEL[cat] ?? cat, items });
    }
    return groups;
  }, [query, category, filtered, categories, channels]);

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
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
      className="mx-auto max-w-7xl space-y-8 px-4 py-8"
    >
      <Seo title="Live TV — Pitch26" description="Stream World Cup 2026 and Cricket channels in HD & 4K." />

      <div className="flex items-center justify-between">
        <h1 className="display text-5xl">Live TV</h1>
        <button onClick={signOut} className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors hover:border-primary">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>

      <AnimatePresence mode="wait">
        {active ? (
          <motion.div key="player"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          >
            <ModernPlayer videoRef={videoRef} channel={active} onClose={() => setActive(null)} />
          </motion.div>
        ) : heroChannel ? (
          <motion.div key="hero"
            initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="live-shimmer relative overflow-hidden rounded-3xl border border-primary/40 bg-gradient-to-br from-primary/20 via-card/70 to-accent/10 p-8 sm:p-12"
          >
            <div className="pointer-events-none absolute inset-0 opacity-40" style={{ background: "radial-gradient(600px circle at 80% -10%, hsl(var(--primary) / 0.35), transparent 60%)" }} />
            <div className="relative">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-primary">
                <Sparkles className="h-3.5 w-3.5" /> Featured live
              </span>
              <h2 className="display mt-4 max-w-2xl text-3xl sm:text-5xl">{heroChannel.name}</h2>
              <p className="mt-2 text-sm uppercase tracking-[0.2em] text-muted-foreground">{CAT_LABEL[heroChannel.category] ?? heroChannel.category}</p>
              <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                onClick={() => play(heroChannel)}
                className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-bold uppercase tracking-[0.15em] text-primary-foreground shadow-lg hover:shadow-primary/30"
              >
                <Play className="h-4 w-4 fill-current" /> Watch now
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-2xl border border-border bg-card/40 p-10 text-center"
          >
            <Tv className="mx-auto h-10 w-10 text-primary" />
            <h2 className="display mt-3 text-2xl">Pick a channel to start watching</h2>
            <p className="mt-1 text-sm text-muted-foreground">{channels.length} channel{channels.length === 1 ? "" : "s"} available</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search channels..."
            className="w-full rounded-md border border-border bg-card/40 py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button key={cat} onClick={() => setCategory(cat)}
              className={`relative rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-[0.15em] transition-colors ${
                category === cat ? "text-primary-foreground" : "border border-border bg-card/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              {category === cat && (
                <motion.span layoutId="livetv-cat" className="absolute inset-0 rounded-full bg-primary" transition={{ type: "spring", stiffness: 320, damping: 28 }} />
              )}
              <span className="relative">{CAT_LABEL[cat] ?? cat}</span>
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading channels…</p>
      ) : isError ? (
        <p className="text-sm text-destructive">{(error as Error).message || "Could not load channels."}</p>
      ) : channels.length === 0 ? (
        <div className="rounded-lg border border-border bg-card/40 p-6 text-sm text-muted-foreground">
          No channels yet. The site admin needs to connect the Xtream server from Settings.
        </div>
      ) : (
        <div className="space-y-10">
          {rows.map((row) => (
            <ChannelRow key={row.title} title={row.title} items={row.items} onPlay={play} activeId={active?.id ?? null} />
          ))}
        </div>
      )}
    </motion.div>
  );
}

function ChannelRow({
  title, items, onPlay, activeId,
}: { title: string; items: Channel[]; onPlay: (c: Channel) => void; activeId: string | null }) {
  return (
    <section className="space-y-3">
      <h3 className="display flex items-center gap-2 text-2xl text-primary">
        <span className="inline-block h-4 w-1 rounded bg-primary" />{title}
        <span className="ml-1 text-xs text-muted-foreground tabular-nums">· {items.length}</span>
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {items.map((c) => (
          <ChannelCard key={title + c.id} channel={c} onPlay={onPlay} isActive={activeId === c.id} />
        ))}
      </div>
    </section>
  );
}

function ChannelCard({ channel: c, onPlay, isActive }: { channel: Channel; onPlay: (c: Channel) => void; isActive: boolean }) {
  return (
    <motion.button
      onClick={() => onPlay(c)}
      whileHover={{ y: -6, scale: 1.03 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className={`group relative w-full overflow-hidden rounded-xl border bg-card/60 text-left shadow-md transition-colors ${
        isActive ? "border-primary ring-2 ring-primary/50" : "border-border hover:border-primary/60"
      }`}
    >
      <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-gradient-to-br from-secondary/40 via-secondary/20 to-primary/10">
        <ChannelLogo url={c.logo_url} name={c.name} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
        {is4k(c.name) && (
          <span className="absolute bottom-2 right-2 rounded bg-gradient-to-r from-amber-400 to-orange-500 px-1.5 py-0.5 text-[10px] font-black tracking-wider text-black shadow">
            4K UHD
          </span>
        )}
        {isActive && (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
            <Radio className="h-3 w-3 animate-pulse" /> On
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 backdrop-blur-[1px] transition-opacity group-hover:opacity-100">
          <Play className="h-8 w-8 fill-primary text-primary" />
        </span>
      </div>
      <div className="p-2.5">
        <p className="truncate text-sm font-semibold">{c.name}</p>
        <p className="truncate text-xs uppercase tracking-[0.15em] text-muted-foreground">
          {CAT_LABEL[c.category] ?? c.category}
        </p>
      </div>
    </motion.button>
  );
}

function ChannelLogo({ url, name }: { url: string | null; name: string }) {
  const [ok, setOk] = useState(!!url);
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
  videoRef, channel, onClose,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  channel: Channel;
  onClose: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(1);
  const [buffering, setBuffering] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [showUI, setShowUI] = useState(true);
  const hideTimer = useRef<number | null>(null);

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
        autoPlay playsInline muted
        onClick={toggle}
        style={{ cursor: showUI ? "pointer" : "none" }}
        className="aspect-video w-full bg-black outline-none focus:outline-none focus-visible:outline-none group-[:fullscreen]:h-full group-[:fullscreen]:object-contain"
      />


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
            className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/80 to-transparent p-4"
          >
            <div className="pointer-events-auto flex items-center gap-3">
              <span className="flex items-center gap-1.5 rounded-full bg-primary/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-primary-foreground">
                <span className="live-dot" /> Live
              </span>
              <div>
                <p className="display text-lg leading-tight text-white">{channel.name}</p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/60">
                  {CAT_LABEL[channel.category] ?? channel.category}
                </p>
              </div>
              {is4k(channel.name) && (
                <span className="rounded bg-gradient-to-r from-amber-400 to-orange-500 px-2 py-0.5 text-[10px] font-black tracking-wider text-black">4K UHD</span>
              )}
            </div>
            <button onClick={onClose}
              className="pointer-events-auto grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white/90 backdrop-blur transition hover:bg-primary hover:text-primary-foreground"
              aria-label="Close player"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!playing && !buffering && (
          <motion.button key="center"
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
            onClick={toggle}
            className="absolute inset-0 m-auto grid h-20 w-20 place-items-center rounded-full bg-primary/90 text-primary-foreground shadow-2xl transition hover:scale-110"
            aria-label="Play"
          >
            <Play className="h-9 w-9 fill-current" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showUI && (
          <motion.div key="bot"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3 sm:p-4"
          >
            <button onClick={toggle}
              className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-primary hover:text-primary-foreground"
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
            </button>
            <button onClick={toggleMute}
              className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-primary hover:text-primary-foreground"
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <input
              type="range" min={0} max={1} step={0.01}
              value={muted ? 0 : volume}
              onChange={(e) => setVol(parseFloat(e.target.value))}
              className="hidden h-1 w-24 cursor-pointer appearance-none rounded-full bg-white/20 accent-primary sm:block"
              aria-label="Volume"
            />
            <div className="ml-auto flex items-center gap-2">
              <button onClick={togglePip}
                className="hidden h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-primary hover:text-primary-foreground sm:grid"
                aria-label="Picture in picture"
              >
                <PictureInPicture2 className="h-4 w-4" />
              </button>
              <button onClick={toggleFs}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-primary hover:text-primary-foreground"
                aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
