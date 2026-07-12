import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Full-screen intro splash. Plays `/splash.mp4` (served from `public/`) once
 * per browser session, then fades out. Tap anywhere to skip.
 */
export default function MobileSplash() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
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

  useEffect(() => {
    if (!visible) return;
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    const p = v.play();
    if (p && typeof p.then === "function") {
      p.then(() => { try { v.muted = false; } catch { /* ignore */ } })
       .catch(() => dismiss());
    }
    const failSafe = window.setTimeout(dismiss, 8000);
    return () => window.clearTimeout(failSafe);
  }, [visible, dismiss]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black transition-opacity duration-500 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
      onClick={dismiss}
      role="button"
      aria-label="Skip intro"
    >
      <video
        ref={videoRef}
        src="/splash.mp4"
        autoPlay
        playsInline
        preload="auto"
        onEnded={dismiss}
        onError={dismiss}
        className="h-full w-full object-cover pointer-events-none select-none"
      />
    </div>
  );
}
