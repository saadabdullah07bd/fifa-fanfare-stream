import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getChannels, getStreamUrl, refreshChannels } from "@/lib/xtream.functions";
import { supabase } from "@/integrations/supabase/client";
import Hls from "hls.js";
import { toast } from "sonner";

export const Route = createFileRoute("/live-tv")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Live TV — Pitch26" },
      { name: "description", content: "Stream World Cup 2026 and Cricket channels from your Xtream server." },
    ],
  }),
  component: LiveTV,
});

type Channel = { id: string; category: string; stream_id: string; name: string; logo_url: string | null };

function LiveTV() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((e) => {
      if (e === "SIGNED_IN" || e === "SIGNED_OUT") setAuthed(e === "SIGNED_IN");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (authed === null) return <div className="p-12 text-center text-muted-foreground">Loading…</div>;
  if (!authed) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="display text-4xl">Live TV</h1>
        <p className="mt-3 text-muted-foreground">Sign in and connect your Xtream server to watch World Cup and Cricket channels.</p>
        <Link to="/auth" className="mt-6 inline-block rounded-md bg-primary px-5 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground">Sign in</Link>
      </div>
    );
  }
  return <LiveTVAuthed />;
}

function LiveTVAuthed() {
  const chFn = useServerFn(getChannels);
  const refreshFn = useServerFn(refreshChannels);
  const streamFn = useServerFn(getStreamUrl);
  const { data: channels = [], refetch } = useQuery({ queryKey: ["channels"], queryFn: () => chFn() as Promise<Channel[]> });

  const [tab, setTab] = useState<"wc2026" | "cricket">("wc2026");
  const [active, setActive] = useState<Channel | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const refresh = useMutation({
    mutationFn: () => refreshFn(),
    onSuccess: async (r) => { toast.success(`${r.channels} channels loaded`); await refetch(); },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (!active || !videoRef.current) return;
    let hls: Hls | undefined;
    (async () => {
      const { url } = await streamFn({ data: { streamId: active.stream_id } });
      const v = videoRef.current!;
      if (Hls.isSupported()) {
        hls = new Hls({ enableWorker: true });
        hls.loadSource(url);
        hls.attachMedia(v);
      } else {
        v.src = url;
      }
      v.play().catch(() => {});
    })().catch((e) => toast.error(e.message));
    return () => { hls?.destroy(); };
  }, [active, streamFn]);

  const filtered = channels.filter((c) => c.category === tab);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="display text-5xl">Live TV</h1>
        <div className="flex gap-2">
          <Link to="/settings" className="rounded-md border border-border bg-secondary px-3 py-2 text-xs font-semibold uppercase tracking-wider">Server</Link>
          <button onClick={() => refresh.mutate()} disabled={refresh.isPending}
            className="rounded-md bg-primary px-3 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50">
            {refresh.isPending ? "…" : "Refresh"}
          </button>
        </div>
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
          No channels yet. Go to <Link to="/settings" className="text-primary">Settings</Link> to connect your Xtream server, then hit Refresh.
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
        {filtered.length === 0 && channels.length > 0 && (
          <p className="col-span-full text-sm text-muted-foreground">No channels in this category yet.</p>
        )}
      </div>
    </div>
  );
}
