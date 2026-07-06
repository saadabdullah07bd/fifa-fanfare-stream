import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/lib/seo";
import Hls from "hls.js";
import { toast } from "sonner";

type Channel = { id: string; category: string; stream_id: string; name: string; logo_url: string | null };

export default function LiveTV() {
  const { data: channels = [] } = useQuery({
    queryKey: ["channels"],
    queryFn: async () => (await supabase.from("channels").select("*").order("category").order("name")).data as Channel[] ?? [],
  });

  const [tab, setTab] = useState<"wc2026" | "cricket">("wc2026");
  const [active, setActive] = useState<Channel | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!active || !videoRef.current) return;
    let hls: Hls | undefined;
    (async () => {
      const { data, error } = await supabase.functions.invoke("xtream", {
        body: { action: "stream_url", streamId: active.stream_id },
      });
      if (error) throw new Error(error.message);
      const url = (data as { url: string }).url;
      const v = videoRef.current!;
      if (Hls.isSupported()) {
        hls = new Hls({ enableWorker: true });
        hls.loadSource(url);
        hls.attachMedia(v);
      } else v.src = url;
      v.play().catch(() => {});
    })().catch((e) => toast.error((e as Error).message));
    return () => { hls?.destroy(); };
  }, [active]);

  const filtered = channels.filter((c) => c.category === tab);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Seo title="Live TV — Pitch26" description="Stream World Cup 2026 and Cricket channels." />
      <div className="flex items-center justify-between">
        <h1 className="display text-5xl">Live TV</h1>
        <Link to="/settings" className="rounded-md border border-border bg-secondary px-3 py-2 text-xs font-semibold uppercase tracking-wider">Account</Link>
      </div>

      {active && (
        <div className="mt-6 overflow-hidden rounded-lg border border-border bg-black">
          <video ref={videoRef} controls autoPlay playsInline className="aspect-video w-full" />
          <div className="flex items-center justify-between p-3">
            <p className="font-semibold">{active.name}</p>
            <button onClick={() => setActive(null)} className="text-xs uppercase tracking-wider text-muted-foreground hover:text-primary">Close</button>
          </div>
        </div>
      )}

      <div className="mt-6 flex gap-2 border-b border-border">
        {(["wc2026", "cricket"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-bold uppercase tracking-wider ${tab === t ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}>
            {t === "wc2026" ? "World Cup" : "Cricket"}
          </button>
        ))}
      </div>

      {channels.length === 0 && (
        <p className="mt-8 rounded-lg border border-border bg-card/40 p-6 text-sm text-muted-foreground">
          No channels yet. The site admin needs to connect the Xtream server from Settings.
        </p>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {filtered.map((c) => (
          <button key={c.id} onClick={() => setActive(c)}
            className="flex items-center gap-3 rounded-lg border border-border bg-card/40 p-3 text-left transition hover:border-primary">
            {c.logo_url ? (
              <img src={c.logo_url} alt="" className="h-10 w-10 rounded object-contain bg-black/30" />
            ) : (
              <div className="grid h-10 w-10 place-items-center rounded bg-primary/20 display text-primary">TV</div>
            )}
            <span className="line-clamp-2 text-sm font-semibold">{c.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
