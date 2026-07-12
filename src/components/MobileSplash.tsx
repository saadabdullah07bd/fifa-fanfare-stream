import { useEffect, useRef, useState } from "react";
import splashVideo from "@/assets/splash-mobile.mp4.asset.json";

/**
 * Full-screen splash shown on mobile viewports on each fresh page load.
 * Plays the WeAre26 hype video muted (with a soft 20% unmute attempt), then fades.
 */
export default function MobileSplash() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isMobile = window.matchMedia("(max-width: 1023px)").matches;
    if (!isMobile) return;
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const v = videoRef.current;
    if (v) {
      // Autoplay policies require muted playback to start automatically.
      v.muted = true;
      v.volume = 0.2;
      const p = v.play();
      if (p && typeof p.then === "function") {
        p.then(() => {
          // Attempt a soft unmute; browsers may still block — that's fine.
          try { v.muted = false; } catch { /* ignore */ }
        }).catch(() => { /* keep muted, still plays */ });
      }
    }
    const failSafe = window.setTimeout(() => dismiss(), 8000);
    return () => window.clearTimeout(failSafe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const dismiss = () => {
    setFading(true);
    window.setTimeout(() => setVisible(false), 450);
  };

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-background transition-opacity duration-500 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
    >
      <video
        ref={videoRef}
        src={splashVideo.url}
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={dismiss}
        onError={dismiss}
        className="h-full w-full object-contain"
      />
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-4 top-4 rounded-full bg-black/60 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white backdrop-blur"
      >
        Skip
      </button>
    </div>
  );
}
