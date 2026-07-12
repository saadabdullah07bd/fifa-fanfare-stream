import { useEffect, useRef, useState } from "react";
import splashVideo from "@/assets/splash-mobile.mp4.asset.json";

/**
 * Full-screen splash shown on each fresh session load.
 * The video is fetched as a blob and played from an in-memory Object URL so
 * download managers (IDM, FDM, etc.) can't hook the source URL. Right-click,
 * drag, picture-in-picture, and the native download control are also blocked.
 */
export default function MobileSplash() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.sessionStorage.getItem("pitch26-splash-seen") === "1") return;
      window.sessionStorage.setItem("pitch26-splash-seen", "1");
    } catch { /* ignore */ }
    setVisible(true);
  }, []);

  // Fetch the video as a blob so IDM/download managers can't sniff a direct URL.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    (async () => {
      try {
        const res = await fetch(splashVideo.url, { credentials: "omit", cache: "force-cache" });
        if (!res.ok) throw new Error("splash fetch failed");
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      } catch {
        // Fallback: use the direct URL if fetch is blocked.
        if (!cancelled) setBlobUrl(splashVideo.url);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [visible]);

  useEffect(() => {
    if (!visible || !blobUrl) return;
    const v = videoRef.current;
    if (v) {
      v.muted = true;
      v.volume = 0.5;
      const p = v.play();
      const tryUnmute = () => {
        try { v.muted = false; v.volume = 0.5; } catch { /* ignore */ }
      };
      if (p && typeof p.then === "function") {
        p.then(tryUnmute).catch(() => { /* stay muted if browser blocks */ });
      } else {
        tryUnmute();
      }
    }
    const failSafe = window.setTimeout(() => dismiss(), 12000);
    return () => window.clearTimeout(failSafe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, blobUrl]);

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
      onContextMenu={(e) => e.preventDefault()}
    >
      {blobUrl && (
        <video
          ref={videoRef}
          src={blobUrl}
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
          className="h-full w-full object-cover pointer-events-none select-none"
        />
      )}
    </div>
  );
}
