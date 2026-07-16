import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Hls from "hls.js";
import mpegts from "mpegts.js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Activity,
  Expand,
  Keyboard,
  Loader2,
  LogOut,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  Radio,
  RotateCw,
  Shrink,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Volume2,
  VolumeX,
} from "lucide-react";

export type Channel = {
  id: string;
  category: string;
  stream_id: string;
  name: string;
  logo_url: string | null;
};

export const is4k = (name: string) => /\b(4k|uhd)\b/i.test(name);

export const categoryLabel = (cat: string) =>
  cat === "bein" ? "beIN Sports Max" : "FIFA World Cup 2026";

type QualityLevel = { index: number; height: number; bitrate: number };

type PlayerStats = {
  engine: string;
  resolution: string;
  dropped: number;
  bufferSec: number;
  bitrateKbps: number | null;
  behindLiveSec: number | null;
};

const VOLUME_KEY = "pitch26:player-volume";

/** How far behind the live edge (seconds) before we surface the GO LIVE pill. */
const BEHIND_LIVE_THRESHOLD = 10;

const SHORTCUTS: Array<[string, string]> = [
  ["Space / K", "Play or pause"],
  ["M", "Mute / unmute"],
  ["F", "Fullscreen"],
  ["P", "Picture in picture"],
  ["T", "Fill / fit screen"],
  ["L", "Jump to live edge"],
  ["← / →", "Back / forward 10s"],
  ["↑ / ↓", "Volume"],
  ["S", "Playback stats"],
  ["PgUp / PgDn", "Previous / next channel"],
  ["?", "This help"],
  ["Esc", "Close player"],
];

/**
 * Self-contained live player: owns the video element, the stream engine and
 * every control. 4K path: hls.js runs with capLevelToPlayerSize OFF so the
 * top rendition (2160p) is always eligible, with a manual quality menu on
 * top; iOS Safari has no MSE, so it plays the HLS URL natively (its decoder
 * picks renditions itself); raw .ts uses mpegts.js where MSE live playback
 * exists, falling back to the signed .m3u8 otherwise — same proven fallback
 * chain the previous player used.
 */
export default function LivePlayer({
  channel,
  onClose,
  onPrev,
  onNext,
}: {
  channel: Channel;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [reloadNonce, setReloadNonce] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(() => {
    const saved = Number(localStorage.getItem(VOLUME_KEY));
    return Number.isFinite(saved) && saved > 0 && saved <= 1 ? saved : 0.5;
  });
  const [buffering, setBuffering] = useState(true);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [fill, setFill] = useState(false);
  const [showUI, setShowUI] = useState(true);
  const [levels, setLevels] = useState<QualityLevel[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1); // -1 = auto
  const [autoLevelHeight, setAutoLevelHeight] = useState<number | null>(null);
  const [menu, setMenu] = useState<"none" | "quality" | "help">("none");
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [behindLive, setBehindLive] = useState(false);
  const engineRef = useRef<string>("—");
  const hideTimer = useRef<number | null>(null);

  const kick = useCallback(() => {
    setShowUI(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      setShowUI(false);
      setMenu("none");
    }, 3000);
  }, []);

  // ---------------------------------------------------------------- engine
  useEffect(() => {
    let cancelled = false;
    let hls: Hls | undefined;
    let mts: ReturnType<typeof mpegts.createPlayer> | undefined;
    let safety = 0;
    let onProgress: (() => void) | null = null;
    let onCanPlay: (() => void) | null = null;
    const v = videoRef.current;
    if (!v) return;

    setBuffering(true);
    setFatalError(null);
    setLevels([]);
    setCurrentLevel(-1);
    setAutoLevelHeight(null);

    (async () => {
      const { data, error } = await supabase.functions.invoke("xtream", {
        body: { action: "stream_url", streamId: channel.stream_id },
      });
      if (cancelled) return;
      if (error) {
        setFatalError(error.message);
        setBuffering(false);
        return;
      }
      const { url, type, fallbackUrl } = data as {
        url: string;
        type?: "mpegts" | "hls";
        fallbackUrl?: string;
      };

      v.muted = false;
      v.volume = volume;
      v.removeAttribute("src");
      v.load();

      // Start once ~3s is buffered (or readyState says go) so playback opens
      // smooth instead of stuttering; a 4s safety timer guarantees a start.
      const MIN_BUFFER_SEC = 3;
      let started = false;
      const startPlay = () => {
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
      onProgress = tryStart;
      onCanPlay = tryStart;
      v.addEventListener("progress", onProgress);
      v.addEventListener("canplaythrough", onCanPlay);
      safety = window.setTimeout(() => {
        started = true;
        startPlay();
      }, 4000);

      /** hls.js tuned for 4K live: never cap the level to element size. */
      const makeHls = () =>
        new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          capLevelToPlayerSize: false,
          startLevel: -1,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          backBufferLength: 30,
          liveSyncDurationCount: 4,
          liveMaxLatencyDurationCount: 12,
          fragLoadingMaxRetry: 6,
          levelLoadingMaxRetry: 6,
        });

      const attachHls = (src: string) => {
        hls = makeHls();
        hlsRef.current = hls;
        engineRef.current = "hls.js";
        let mediaRecoveries = 0;
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (cancelled || !hls) return;
          setLevels(
            hls.levels
              .map((l, i) => ({ index: i, height: l.height || 0, bitrate: l.bitrate || 0 }))
              .sort((a, b) => b.height - a.height || b.bitrate - a.bitrate),
          );
        });
        hls.on(Hls.Events.LEVEL_SWITCHED, (_e, d) => {
          if (cancelled || !hls) return;
          setAutoLevelHeight(hls.levels[d.level]?.height ?? null);
        });
        hls.on(Hls.Events.ERROR, (_e, d) => {
          if (cancelled || !hls) return;
          if (!d.fatal) return;
          // Standard hls.js fatal recovery ladder before giving up.
          if (d.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
          } else if (d.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoveries < 2) {
            mediaRecoveries += 1;
            hls.recoverMediaError();
          } else {
            console.error("HLS fatal error", d);
            setFatalError("This channel is not sending playable video right now.");
            setBuffering(false);
          }
        });
        hls.loadSource(src);
        hls.attachMedia(v);
      };

      const canMpegts = type === "mpegts" && mpegts.getFeatureList().mseLivePlayback;
      const useHlsForMpegts = type === "mpegts" && !canMpegts && !!fallbackUrl;

      if (canMpegts) {
        engineRef.current = "mpegts.js";
        mts = mpegts.createPlayer(
          { type: "mpegts", isLive: true, url },
          {
            enableStashBuffer: true,
            stashInitialSize: 384,
            liveBufferLatencyChasing: false,
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
            try {
              mts?.pause();
              mts?.unload();
              mts?.detachMediaElement();
              mts?.destroy();
            } catch {
              /* ignore */
            }
            mts = undefined;
            attachHls(fallbackUrl);
            return;
          }
          setFatalError("This channel is not sending playable video right now.");
          setBuffering(false);
        });
        mts.attachMediaElement(v);
        mts.load();
      } else if (Hls.isSupported() && !url.endsWith(".mp4")) {
        attachHls(useHlsForMpegts ? fallbackUrl! : url);
      } else {
        // Native playback (iOS Safari plays HLS itself and picks renditions,
        // including 4K, in its own decoder). Never hand it a raw .ts URL.
        engineRef.current = "native";
        v.src = useHlsForMpegts ? fallbackUrl! : url;
      }
    })().catch((e) => {
      if (!cancelled) {
        setFatalError((e as Error).message);
        setBuffering(false);
      }
    });

    return () => {
      cancelled = true;
      window.clearTimeout(safety);
      if (onProgress) v.removeEventListener("progress", onProgress);
      if (onCanPlay) v.removeEventListener("canplaythrough", onCanPlay);
      hlsRef.current = null;
      hls?.destroy();
      try {
        mts?.pause();
        mts?.unload();
        mts?.detachMediaElement();
        mts?.destroy();
      } catch {
        /* ignore */
      }
    };
    // volume intentionally excluded: it must not restart the stream.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.stream_id, reloadNonce]);

  // ------------------------------------------------------- element state
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => setBuffering(false);
    const onVolume = () => {
      setMuted(v.muted);
      setVolume(v.volume);
      if (!v.muted && v.volume > 0) localStorage.setItem(VOLUME_KEY, String(v.volume));
    };
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
  }, [channel.id]);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    kick();
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, [channel.id, kick]);

  // ------------------------------------------------ live edge + stats poll
  useEffect(() => {
    const id = window.setInterval(() => {
      const v = videoRef.current;
      if (!v) return;
      const hls = hlsRef.current;
      let edge: number | null = null;
      if (hls?.liveSyncPosition != null) edge = hls.liveSyncPosition;
      else if (v.seekable.length) edge = v.seekable.end(v.seekable.length - 1);
      const behind = edge != null ? Math.max(0, edge - v.currentTime) : null;
      setBehindLive(behind != null && behind > BEHIND_LIVE_THRESHOLD && !v.paused);

      if (showStats) {
        const q = (
          v as HTMLVideoElement & { getVideoPlaybackQuality?: () => VideoPlaybackQuality }
        ).getVideoPlaybackQuality?.();
        const b = v.buffered;
        const ahead = b.length ? Math.max(0, b.end(b.length - 1) - v.currentTime) : 0;
        const level = hls && hls.currentLevel >= 0 ? hls.levels[hls.currentLevel] : null;
        setStats({
          engine: engineRef.current,
          resolution: v.videoWidth ? `${v.videoWidth}×${v.videoHeight}` : "—",
          dropped: q?.droppedVideoFrames ?? 0,
          bufferSec: Math.round(ahead * 10) / 10,
          bitrateKbps: level ? Math.round(level.bitrate / 1000) : null,
          behindLiveSec: behind != null ? Math.round(behind) : null,
        });
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [showStats]);

  // -------------------------------------------------------------- actions
  const toggle = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (v) v.muted = !v.muted;
  }, []);

  const setVol = useCallback((val: number) => {
    const v = videoRef.current;
    if (v) {
      v.volume = val;
      v.muted = val === 0;
    }
  }, []);

  const seekBy = useCallback((sec: number) => {
    const v = videoRef.current;
    if (!v || !v.seekable.length) return;
    const start = v.seekable.start(0);
    const end = v.seekable.end(v.seekable.length - 1);
    try {
      v.currentTime = Math.min(Math.max(v.currentTime + sec, start), end);
    } catch {
      /* live stream without seekable range */
    }
  }, []);

  const goLive = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const hls = hlsRef.current;
    try {
      if (hls?.liveSyncPosition != null) v.currentTime = hls.liveSyncPosition;
      else if (v.seekable.length) v.currentTime = v.seekable.end(v.seekable.length - 1) - 0.5;
      v.play();
    } catch {
      /* ignore */
    }
  }, []);

  const toggleFs = useCallback(async () => {
    if (!wrapRef.current) return;
    if (document.fullscreenElement) {
      try {
        (screen.orientation as unknown as { unlock?: () => void })?.unlock?.();
      } catch {
        /* ignore */
      }
      await document.exitFullscreen();
    } else {
      await wrapRef.current.requestFullscreen();
      if (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) {
        try {
          await (screen.orientation as unknown as { lock?: (o: string) => Promise<void> })?.lock?.(
            "landscape",
          );
        } catch {
          /* not supported */
        }
      }
    }
  }, []);

  const togglePip = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await v.requestPictureInPicture();
    } catch {
      /* not supported */
    }
  }, []);

  const setQuality = useCallback((index: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    hls.currentLevel = index; // -1 = auto
    setCurrentLevel(index);
    setMenu("none");
  }, []);

  const reload = useCallback(() => {
    toast.message("Reloading stream…");
    setReloadNonce((n) => n + 1);
  }, []);

  // ------------------------------------------------------------ shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const v = videoRef.current;
      if (!v) return;
      if (e.key === "?") {
        e.preventDefault();
        setMenu((m) => (m === "help" ? "none" : "help"));
        kick();
        return;
      }
      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          toggle();
          break;
        case "m":
          e.preventDefault();
          toggleMute();
          break;
        case "f":
          e.preventDefault();
          toggleFs();
          break;
        case "p":
          e.preventDefault();
          togglePip();
          break;
        case "t":
          e.preventDefault();
          setFill((f) => !f);
          break;
        case "l":
          e.preventDefault();
          goLive();
          break;
        case "s":
          e.preventDefault();
          setShowStats((s) => !s);
          break;
        case "arrowup":
          e.preventDefault();
          setVol(Math.min(1, v.volume + 0.1));
          break;
        case "arrowdown":
          e.preventDefault();
          setVol(Math.max(0, v.volume - 0.1));
          break;
        case "arrowright":
          e.preventDefault();
          seekBy(10);
          break;
        case "arrowleft":
          e.preventDefault();
          seekBy(-10);
          break;
        case "pageup":
          e.preventDefault();
          onPrev?.();
          break;
        case "pagedown":
          e.preventDefault();
          onNext?.();
          break;
        case "escape":
          if (menu !== "none") setMenu("none");
          else if (!document.fullscreenElement) onClose();
          break;
        default:
          return;
      }
      kick();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    toggle,
    toggleMute,
    toggleFs,
    togglePip,
    goLive,
    seekBy,
    setVol,
    kick,
    menu,
    onClose,
    onPrev,
    onNext,
  ]);

  // Clicking/tapping the video surface only reveals the controls — it never
  // toggles playback. Pause happens exclusively via the pause button (or
  // Space/K on a keyboard). The old click-to-pause used a width-based mobile
  // check, so a phone in landscape (~812px wide) was treated as desktop and
  // every tap to show the overlay paused the stream. Double-click/double-tap
  // still toggles fullscreen.
  const onSurfaceClick = () => {
    kick();
  };
  const onSurfaceDoubleClick = () => {
    toggleFs();
  };

  const qualityLabel = useMemo(() => {
    if (!levels.length) return null;
    if (currentLevel === -1) return autoLevelHeight ? `Auto (${autoLevelHeight}p)` : "Auto";
    const l = levels.find((x) => x.index === currentLevel);
    return l ? `${l.height}p` : "Auto";
  }, [levels, currentLevel, autoLevelHeight]);

  return (
    <div
      ref={wrapRef}
      data-player
      onMouseMove={kick}
      onTouchStart={kick}
      style={{ cursor: showUI ? "" : "none" }}
      className="live-player group relative overflow-hidden rounded-2xl border border-primary/30 bg-black shadow-[0_30px_80px_-20px_rgba(var(--primary-rgb),0.35)] outline-none focus:outline-none focus-visible:outline-none [&:fullscreen]:h-screen [&:fullscreen]:w-screen [&:fullscreen]:rounded-none [&:fullscreen]:border-0 [&:fullscreen]:shadow-none"
      tabIndex={-1}
    >
      <video
        ref={videoRef}
        playsInline
        controlsList="nodownload noremoteplayback noplaybackrate"
        onContextMenu={(e) => e.preventDefault()}
        onClick={onSurfaceClick}
        onDoubleClick={onSurfaceDoubleClick}
        style={{ cursor: showUI ? "pointer" : "none" }}
        className={`aspect-video h-full w-full bg-black outline-none group-[:fullscreen]:h-full ${
          fill
            ? "object-cover group-[:fullscreen]:object-cover"
            : "object-contain group-[:fullscreen]:object-contain"
        }`}
      />

      {/* No custom volume gesture on touch devices: the media element's
          volume is left alone so the phone's hardware volume buttons control
          the stream natively, like any other media app. */}

      {/* Buffering */}
      <AnimatePresence>
        {buffering && !fatalError && (
          <motion.div
            key="buf"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 grid place-items-center bg-black/30 backdrop-blur-[2px]"
          >
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fatal error with retry */}
      <AnimatePresence>
        {fatalError && (
          <motion.div
            key="err"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 grid place-items-center bg-black/80 p-6 text-center"
          >
            <div>
              <p className="text-sm text-white/85">{fatalError}</p>
              <button
                type="button"
                onClick={reload}
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold uppercase tracking-wider text-primary-foreground transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <RotateCw className="h-4 w-4" aria-hidden="true" /> Try again
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats for nerds */}
      <AnimatePresence>
        {showStats && stats && (
          <motion.dl
            key="stats"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            className="absolute left-3 top-16 z-30 grid grid-cols-[auto_auto] gap-x-4 gap-y-1 rounded-xl bg-black/75 p-3 font-mono text-[11px] text-white/90 backdrop-blur"
            aria-label="Playback statistics"
          >
            <dt className="text-white/50">Engine</dt>
            <dd>{stats.engine}</dd>
            <dt className="text-white/50">Resolution</dt>
            <dd>{stats.resolution}</dd>
            {stats.bitrateKbps != null && (
              <>
                <dt className="text-white/50">Bitrate</dt>
                <dd>{stats.bitrateKbps} kbps</dd>
              </>
            )}
            <dt className="text-white/50">Buffer</dt>
            <dd>{stats.bufferSec}s</dd>
            <dt className="text-white/50">Dropped</dt>
            <dd>{stats.dropped}</dd>
            {stats.behindLiveSec != null && (
              <>
                <dt className="text-white/50">Behind live</dt>
                <dd>{stats.behindLiveSec}s</dd>
              </>
            )}
          </motion.dl>
        )}
      </AnimatePresence>

      {/* Shortcuts help */}
      <AnimatePresence>
        {menu === "help" && (
          <motion.div
            key="help"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="absolute inset-0 z-40 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
            onClick={() => setMenu("none")}
          >
            <div
              className="max-h-full w-full max-w-sm overflow-y-auto rounded-2xl border border-white/10 bg-black/85 p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-white/70">
                <Keyboard className="h-4 w-4" aria-hidden="true" /> Keyboard shortcuts
              </p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                {SHORTCUTS.map(([key, what]) => (
                  <div key={key} className="contents">
                    <dt>
                      <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-white">
                        {key}
                      </kbd>
                    </dt>
                    <dd className="text-white/75">{what}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top bar */}
      <AnimatePresence>
        {showUI && (
          <motion.div
            key="top"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 bg-gradient-to-b from-black/85 via-black/40 to-transparent p-3 sm:p-4"
          >
            <div className="pointer-events-auto flex min-w-0 items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-lg">
                <span className="live-dot" aria-hidden="true" /> Live
              </span>
              <div className="min-w-0">
                <p
                  className="display truncate text-base leading-tight text-white sm:text-lg"
                  title={channel.name}
                >
                  {channel.name}
                </p>
                <p className="truncate text-[10px] uppercase tracking-[0.2em] text-white/60">
                  {categoryLabel(channel.category)}
                </p>
              </div>
              {is4k(channel.name) && (
                <span className="hidden rounded bg-gradient-to-r from-amber-400 to-orange-500 px-2 py-0.5 text-[10px] font-black tracking-wider text-black sm:inline-block">
                  4K UHD
                </span>
              )}
            </div>

            <div className="pointer-events-auto flex items-center gap-2">
              {(onPrev || onNext) && (
                <span className="hidden items-center gap-1 sm:inline-flex">
                  <PlayerBtn onClick={() => onPrev?.()} label="Previous channel (PgUp)">
                    <SkipBack className="h-4 w-4" aria-hidden="true" />
                  </PlayerBtn>
                  <PlayerBtn onClick={() => onNext?.()} label="Next channel (PgDn)">
                    <SkipForward className="h-4 w-4" aria-hidden="true" />
                  </PlayerBtn>
                </span>
              )}
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

      {/* Center play */}
      <AnimatePresence>
        {!playing && !buffering && !fatalError && (
          <motion.button
            key="center"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            onClick={toggle}
            className="absolute inset-0 m-auto grid h-20 w-20 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_0_0_8px_rgba(var(--primary-rgb),0.15),0_20px_60px_-10px_rgba(var(--primary-rgb),0.6)] transition hover:scale-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/40"
            aria-label="Play"
          >
            <Play className="h-9 w-9 fill-current" aria-hidden="true" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Behind-live pill */}
      <AnimatePresence>
        {behindLive && !buffering && (
          <motion.button
            key="golive"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            onClick={goLive}
            className="absolute bottom-20 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-destructive px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-white shadow-lg transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            title="Jump to live edge (L)"
          >
            <Radio className="h-3.5 w-3.5 animate-pulse" aria-hidden="true" /> Go live
          </motion.button>
        )}
      </AnimatePresence>

      {/* Quality menu */}
      <AnimatePresence>
        {menu === "quality" && levels.length > 0 && (
          <motion.div
            key="quality"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="absolute bottom-20 right-4 z-30 min-w-36 overflow-hidden rounded-xl border border-white/10 bg-black/85 py-1 backdrop-blur"
            role="menu"
            aria-label="Stream quality"
          >
            <QualityItem active={currentLevel === -1} onClick={() => setQuality(-1)}>
              Auto{autoLevelHeight ? ` (${autoLevelHeight}p)` : ""}
            </QualityItem>
            {levels.map((l) => (
              <QualityItem
                key={l.index}
                active={currentLevel === l.index}
                onClick={() => setQuality(l.index)}
              >
                {l.height >= 2160 ? `${l.height}p · 4K` : `${l.height}p`}
                <span className="ml-2 text-[10px] text-white/40">
                  {Math.round(l.bitrate / 1000)}k
                </span>
              </QualityItem>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom control bar */}
      <AnimatePresence>
        {showUI && (
          <motion.div
            key="bot"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 sm:p-4"
          >
            <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 p-1 backdrop-blur-md sm:gap-2 sm:p-1.5">
              <PlayerBtn onClick={toggle} label={playing ? "Pause (K)" : "Play (K)"}>
                {playing ? (
                  <Pause className="h-4 w-4 fill-current" aria-hidden="true" />
                ) : (
                  <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                )}
              </PlayerBtn>
              <PlayerBtn onClick={toggleMute} label={muted ? "Unmute (M)" : "Mute (M)"}>
                {muted || volume === 0 ? (
                  <VolumeX className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Volume2 className="h-4 w-4" aria-hidden="true" />
                )}
              </PlayerBtn>
              <div className="volume-slider group/vol hidden items-center pl-1 pr-2 sm:flex">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={muted ? 0 : volume}
                  onChange={(e) => setVol(parseFloat(e.target.value))}
                  style={{ ["--vol" as string]: `${Math.round((muted ? 0 : volume) * 100)}%` }}
                  className="modern-range h-1.5 w-20 cursor-pointer appearance-none rounded-full transition-all group-hover/vol:w-32 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label="Volume"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round((muted ? 0 : volume) * 100)}
                />
              </div>

              <span aria-hidden="true" className="mx-1 hidden h-5 w-px bg-white/10 sm:block" />

              <button
                type="button"
                onClick={goLive}
                title="Jump to live edge (L)"
                className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white transition sm:inline-flex ${
                  behindLive ? "bg-white/15 hover:bg-white/25" : "bg-destructive/20"
                }`}
              >
                <span className="live-dot" aria-hidden="true" /> Live
              </button>

              <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
                {qualityLabel && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenu((m) => (m === "quality" ? "none" : "quality"));
                      kick();
                    }}
                    aria-label={`Stream quality: ${qualityLabel}`}
                    title="Stream quality"
                    aria-expanded={menu === "quality"}
                    className={`inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-white transition hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      menu === "quality" ? "bg-primary/80" : "bg-white/5"
                    }`}
                  >
                    <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden md:inline">{qualityLabel}</span>
                  </button>
                )}
                <PlayerBtn
                  onClick={() => {
                    setShowStats((s) => !s);
                    kick();
                  }}
                  label="Playback stats (S)"
                  active={showStats}
                  className="hidden sm:grid"
                >
                  <Activity className="h-4 w-4" aria-hidden="true" />
                </PlayerBtn>
                <PlayerBtn onClick={reload} label="Reload stream">
                  <RotateCw className="h-4 w-4" aria-hidden="true" />
                </PlayerBtn>
                <PlayerBtn
                  onClick={() => {
                    setFill((f) => !f);
                    kick();
                  }}
                  label={fill ? "Fit to screen (T)" : "Fill screen (T)"}
                  active={fill}
                >
                  {fill ? (
                    <Shrink className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Expand className="h-4 w-4" aria-hidden="true" />
                  )}
                </PlayerBtn>
                <PlayerBtn
                  onClick={togglePip}
                  label="Picture in picture (P)"
                  className="hidden sm:grid"
                >
                  <PictureInPicture2 className="h-4 w-4" aria-hidden="true" />
                </PlayerBtn>
                <PlayerBtn
                  onClick={toggleFs}
                  label={fullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"}
                >
                  {fullscreen ? (
                    <Minimize className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Maximize className="h-4 w-4" aria-hidden="true" />
                  )}
                </PlayerBtn>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function QualityItem({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      onClick={onClick}
      className={`flex w-full items-center px-4 py-2 text-left text-sm transition ${
        active ? "bg-primary/25 font-semibold text-white" : "text-white/80 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
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
