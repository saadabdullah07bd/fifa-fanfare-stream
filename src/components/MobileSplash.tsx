import { useEffect, useRef, useState } from "react";
import splashVideo from "@/assets/splash-mobile.mp4.asset.json";

const SESSION_KEY = "pitch26:splash-shown";

/**
 * Full-screen animated splash shown on mobile viewports on first load per session.
 * Plays the WeAre26 hype video, then fades out. Desktop users skip it entirely.
 */
export default function MobileSplash() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isMobile = window.matchMedia("(max-width: 1023px)").matches;
    const shown = window.sessionStorage.getItem(SESSION_KEY);
    if (!isMobile || shown) return;
    window.sessionStorage.setItem(SESSION_KEY, "1");
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible) return;
    // Safety timeout in case video fails/blocked
    const failSafe = window.setTimeout(() => dismiss(), 6000);
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
      onClick={dismiss}
    >
      <video
        ref={videoRef}
        src={splashVideo.url}
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={dismiss}
        className="h-full w-full object-cover"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-10 flex flex-col items-center gap-2">
        <span className="display text-3xl tracking-[0.3em] text-foreground drop-shadow-lg">
          PITCH<span className="text-primary">26</span>
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-foreground/70">
          We are 26
        </span>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); dismiss(); }}
        className="absolute right-4 top-4 rounded-full bg-black/50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur"
      >
        Skip
      </button>
    </div>
  );
}
