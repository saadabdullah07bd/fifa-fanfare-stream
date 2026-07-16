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
    } catch {
      /* ignore */
    }
    setVisible(true);
  }, []);

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    setFading(true);
    // Matches the overlay's duration-500 so the fade completes before unmount.
    window.setTimeout(() => setVisible(false), 500);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const v = videoRef.current;
    if (!v) return;
    // Must stay muted for the whole clip: unmuting a video mid-playback trips
    // the mobile autoplay policy and pauses it — which froze the splash on its
    // first frame. Splash intros are silent by design, so keep it muted.
    v.muted = true;
    const tryPlay = () => {
      const p = v.play();
      if (p && typeof p.then === "function") p.catch(() => dismiss());
    };
    if (v.readyState >= 2) tryPlay();
    else v.addEventListener("loadeddata", tryPlay, { once: true });
    const failSafe = window.setTimeout(dismiss, 8000);
    return () => {
      window.clearTimeout(failSafe);
      v.removeEventListener("loadeddata", tryPlay);
    };
  }, [visible, dismiss]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black transition-opacity duration-500 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
      onClick={dismiss}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
          e.preventDefault();
          dismiss();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label="Skip intro"
    >
      {/* object-cover fills every screen edge-to-edge; the crop on mismatched
          aspect ratios is intentional (no letterbox bars on any device). */}
      <video
        ref={videoRef}
        src="/splash.mp4"
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={dismiss}
        onError={dismiss}
        className="h-full w-full object-cover pointer-events-none select-none"
      />
    </div>
  );
}
