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
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const v = videoRef.current;
    if (v) {
      // Autoplay requires muted playback — keep it muted so the video keeps
      // playing after the first frame instead of getting paused on unmute.
      v.muted = true;
      v.volume = 0;
      const p = v.play();
      if (p && typeof p.then === "function") {
        p.catch(() => { /* keep muted, still plays */ });
      }
    }
    const failSafe = window.setTimeout(() => dismiss(), 12000);
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
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black transition-opacity duration-500 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
    >
      <video
        ref={videoRef}
        src={splashVideo.url}
        autoPlay
        muted
        loop={false}
        playsInline
        preload="auto"
        onEnded={dismiss}
        onError={dismiss}
        className="h-full w-full object-cover"
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
