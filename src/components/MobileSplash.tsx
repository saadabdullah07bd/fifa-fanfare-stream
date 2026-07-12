import { useEffect, useRef, useState, useCallback } from "react";
import splashVideo from "@/assets/splash-mobile.mp4.asset.json";

/**
 * Full-screen splash shown once per session.
 *
 * Reliability notes (fixes for Chrome desktop + mobile):
 *  - Some Chrome builds block autoplay-with-audio, or fail the blob fetch on
 *    slow networks. In both cases the old code showed a stalled black screen.
 *  - We now: (1) fall back to the direct URL immediately if fetch fails,
 *    (2) dismiss on any playback error / stall / autoplay rejection,
 *    (3) let the user tap anywhere to skip, (4) shorten the failsafe to 6s.
 */
export default function MobileSplash() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const dismissedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.sessionStorage.getItem("pitch26-splash-seen") === "1") return;
      window.sessionStorage.setItem("pitch26-splash-seen", "1");
    } catch { /* ignore */ }
    setVisible(true);
  }, []);

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    setFading(true);
    window.setTimeout(() => setVisible(false), 400);
  }, []);

  // Resolve the video URL. Try a blob fetch (defeats download managers) but
  // fall back to the direct URL the moment anything goes wrong so playback
  // isn't blocked on flaky networks / restrictive Chrome configurations.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    // Kick off with the direct URL immediately so playback can start even if
    // the blob fetch is slow; upgrade to the blob URL when it resolves.
    setSrc(splashVideo.url);
    (async () => {
      try {
        const res = await fetch(splashVideo.url, { credentials: "omit", cache: "force-cache" });
        if (!res.ok) return;
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } catch { /* keep direct URL fallback */ }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const v = videoRef.current;
    if (v) {
      v.muted = true;
      v.volume = 0.5;
      const p = v.play();
      const tryUnmute = () => { try { v.muted = false; v.volume = 0.5; } catch { /* ignore */ } };
      if (p && typeof p.then === "function") {
        p.then(tryUnmute).catch(() => {
          // Autoplay blocked entirely — skip the splash so the app is usable.
          dismiss();
        });
      } else {
        tryUnmute();
      }
    }
    const failSafe = window.setTimeout(dismiss, 6000);
    return () => window.clearTimeout(failSafe);
  }, [visible, src, dismiss]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black transition-opacity duration-500 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
      onClick={dismiss}
      onContextMenu={(e) => e.preventDefault()}
      role="button"
      aria-label="Skip intro"
    >
      {src && (
        <video
          ref={videoRef}
          src={src}
          autoPlay
          muted
          loop={false}
          playsInline
          preload="auto"
          controls={false}
          disablePictureInPicture
          disableRemotePlayback
          controlsList="nodownload noplaybackrate nofullscreen noremoteplayback"
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
          onEnded={dismiss}
          onError={dismiss}
          onStalled={() => window.setTimeout(dismiss, 1500)}
          className="h-full w-full object-cover pointer-events-none select-none"
        />
      )}
    </div>
  );
}
