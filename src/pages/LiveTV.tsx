import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/lib/seo";
import Hls from "hls.js";
import { toast } from "sonner";
import { Search, Tv, Radio, Play, Sparkles, X, ChevronLeft, ChevronRight } from "lucide-react";

type Channel = { id: string; category: string; stream_id: string; name: string; logo_url: string | null };

const is4k = (name: string) => /\b(4k|uhd)\b/i.test(name);
const CAT_LABEL: Record<string, string> = { wc2026: "World Cup 2026", cricket: "Cricket" };

export default function LiveTV() {
  const { data: channels = [], isLoading, isError, error } = useQuery({
    queryKey: ["channels"],
    queryFn: async () => {
      const { data, error } = await supabase.from("channels").select("*").order("category").order("name");
      if (error) throw new Error(error.message);
      return ((data as Channel[] | null) ?? [])
        .sort((a, b) => (is4k(a.name) ? 1 : 0) - (is4k(b.name) ? 1 : 0) || a.name.localeCompare(b.name));
    },
  });

  const [active, setActive] = useState<Channel | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");
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

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(channels.map((c) => c.category))).sort()],
    [channels],
  );

  const heroChannel = useMemo(
    () => channels.find((c) => !is4k(c.name)) ?? channels[0] ?? null,
    [channels],
  );

  const filtered = useMemo(
    () =>
      channels.filter(
        (c) =>
          (category === "All" || c.category === category) &&
          c.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [channels, query, category],
  );

  const rows = useMemo(() => {
    const searching = query.trim().length > 0 || category !== "All";
    if (searching) return [{ title: "Results", items: filtered }];
    const groups: { title: string; items: Channel[] }[] = [];
    for (const cat of categories.filter((c) => c !== "All")) {
      const items = channels.filter((c) => c.category === cat);
      if (items.length) groups.push({ title: CAT_LABEL[cat] ?? cat, items });
    }
    return groups;
  }, [query, category, filtered, categories, channels]);

  const play = (c: Channel) => {
    setActive(c);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
      className="mx-auto max-w-7xl space-y-8 px-4 py-8"
    >
      <Seo title="Live TV — Pitch26" description="Stream World Cup 2026 and Cricket channels in HD & 4K." />

      <div className="flex items-center justify-between">
        <h1 className="display text-5xl">Live TV</h1>
        <Link to="/settings" className="rounded-md border border-border bg-secondary px-3 py-2 text-xs font-semibold uppercase tracking-wider hover:border-primary transition-colors">Account</Link>
      </div>

      <AnimatePresence mode="wait">
        {active ? (
          <motion.div key="player"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="overflow-hidden rounded-2xl border border-border bg-black shadow-2xl"
          >
            <video ref={videoRef} controls autoPlay playsInline className="aspect-video w-full" poster={active.logo_url ?? undefined} />
            <div className="flex flex-wrap items-center gap-3 border-t border-border bg-card/60 p-4">
              <h2 className="display text-xl">{active.name}</h2>
              <span className="rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {CAT_LABEL[active.category] ?? active.category}
              </span>
              <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-primary">
                <Radio className="h-3 w-3 animate-pulse" /> Live
              </span>
              {is4k(active.name) && (
                <span className="rounded bg-gradient-to-r from-amber-400 to-orange-500 px-2 py-0.5 text-[10px] font-black tracking-wider text-black">4K UHD</span>
              )}
              <button onClick={() => setActive(null)} className="ml-auto flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs uppercase tracking-wider hover:border-primary hover:text-primary transition-colors">
                <X className="h-3.5 w-3.5" /> Close
              </button>
            </div>
          </motion.div>
        ) : heroChannel ? (
          <motion.div key="hero"
            initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="live-shimmer relative overflow-hidden rounded-3xl border border-primary/40 bg-gradient-to-br from-primary/20 via-card/70 to-accent/10 p-8 sm:p-12"
          >
            <div className="pointer-events-none absolute inset-0 opacity-40" style={{ background: "radial-gradient(600px circle at 80% -10%, hsl(var(--primary) / 0.35), transparent 60%)" }} />
            <div className="relative">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-primary">
                <Sparkles className="h-3.5 w-3.5" /> Featured live
              </span>
              <h2 className="display mt-4 max-w-2xl text-3xl sm:text-5xl">{heroChannel.name}</h2>
              <p className="mt-2 text-sm uppercase tracking-[0.2em] text-muted-foreground">{CAT_LABEL[heroChannel.category] ?? heroChannel.category}</p>
              <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                onClick={() => play(heroChannel)}
                className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-bold uppercase tracking-[0.15em] text-primary-foreground shadow-lg hover:shadow-primary/30"
              >
                <Play className="h-4 w-4 fill-current" /> Watch now
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-2xl border border-border bg-card/40 p-10 text-center"
          >
            <Tv className="mx-auto h-10 w-10 text-primary" />
            <h2 className="display mt-3 text-2xl">Pick a channel to start watching</h2>
            <p className="mt-1 text-sm text-muted-foreground">{channels.length} channel{channels.length === 1 ? "" : "s"} available</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search channels..."
            className="w-full rounded-md border border-border bg-card/40 py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button key={cat} onClick={() => setCategory(cat)}
              className={`relative rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-[0.15em] transition-colors ${
                category === cat ? "text-primary-foreground" : "border border-border bg-card/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              {category === cat && (
                <motion.span layoutId="livetv-cat" className="absolute inset-0 rounded-full bg-primary" transition={{ type: "spring", stiffness: 320, damping: 28 }} />
              )}
              <span className="relative">{CAT_LABEL[cat] ?? cat}</span>
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading channels…</p>
      ) : isError ? (
        <p className="text-sm text-destructive">{(error as Error).message || "Could not load channels."}</p>
      ) : channels.length === 0 ? (
        <div className="rounded-lg border border-border bg-card/40 p-6 text-sm text-muted-foreground">
          No channels yet. The site admin needs to connect the Xtream server from Settings.
        </div>
      ) : (
        <div className="space-y-10">
          {rows.map((row) => (
            <ChannelRow key={row.title} title={row.title} items={row.items} onPlay={play} activeId={active?.id ?? null} />
          ))}
        </div>
      )}
    </motion.div>
  );
}

function ChannelRow({
  title, items, onPlay, activeId,
}: { title: string; items: Channel[]; onPlay: (c: Channel) => void; activeId: string | null }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState<{ left: boolean; right: boolean }>({ left: false, right: false });

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const check = () => setOverflow({
      left: el.scrollLeft > 8,
      right: el.scrollWidth - el.clientWidth - el.scrollLeft > 8,
    });
    check();
    el.addEventListener("scroll", check);
    window.addEventListener("resize", check);
    return () => { el.removeEventListener("scroll", check); window.removeEventListener("resize", check); };
  }, [items.length]);

  const scrollBy = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <section className="group/row space-y-3">
      <h3 className="display flex items-center gap-2 text-2xl text-primary">
        <span className="inline-block h-4 w-1 rounded bg-primary" />{title}
        <span className="ml-1 text-xs text-muted-foreground tabular-nums">· {items.length}</span>
      </h3>
      <div className="relative">
        <AnimatePresence>
          {overflow.left && (
            <motion.button
              key="l" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }}
              onClick={() => scrollBy(-1)} aria-label="Scroll left"
              className="absolute left-0 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-primary/40 bg-background/90 text-primary shadow-lg backdrop-blur hover:bg-primary hover:text-primary-foreground transition"
            >
              <ChevronLeft className="h-5 w-5" />
            </motion.button>
          )}
          {overflow.right && (
            <motion.button
              key="r" initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 6 }}
              onClick={() => scrollBy(1)} aria-label="Scroll right"
              className="absolute right-0 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-primary/40 bg-background/90 text-primary shadow-lg backdrop-blur hover:bg-primary hover:text-primary-foreground transition"
            >
              <ChevronRight className="h-5 w-5" />
            </motion.button>
          )}
        </AnimatePresence>
        <div ref={scrollerRef}
          className="-mx-1 flex gap-3 overflow-x-auto scroll-smooth px-1 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((c) => (
            <ChannelCard key={title + c.id} channel={c} onPlay={onPlay} isActive={activeId === c.id} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ChannelCard({ channel: c, onPlay, isActive }: { channel: Channel; onPlay: (c: Channel) => void; isActive: boolean }) {
  return (
    <motion.button
      onClick={() => onPlay(c)}
      whileHover={{ y: -6, scale: 1.03 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className={`group relative w-44 shrink-0 overflow-hidden rounded-xl border bg-card/60 text-left shadow-md transition-colors sm:w-52 ${
        isActive ? "border-primary ring-2 ring-primary/50" : "border-border hover:border-primary/60"
      }`}
    >
      <div className="relative flex aspect-video items-center justify-center bg-secondary/30">
        {c.logo_url ? (
          <img src={c.logo_url} alt={c.name} className="max-h-full max-w-full object-contain p-3" loading="lazy" />
        ) : (
          <Tv className="h-8 w-8 text-muted-foreground" />
        )}
        {is4k(c.name) && (
          <span className="absolute bottom-2 right-2 rounded bg-gradient-to-r from-amber-400 to-orange-500 px-1.5 py-0.5 text-[10px] font-black tracking-wider text-black shadow">
            4K UHD
          </span>
        )}
        {isActive && (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
            <Radio className="h-3 w-3 animate-pulse" /> On
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 backdrop-blur-[1px] transition-opacity group-hover:opacity-100">
          <Play className="h-8 w-8 fill-primary text-primary" />
        </span>
      </div>
      <div className="p-2.5">
        <p className="truncate text-sm font-semibold">{c.name}</p>
        <p className="truncate text-xs uppercase tracking-[0.15em] text-muted-foreground">
          {CAT_LABEL[c.category] ?? c.category}
        </p>
      </div>
    </motion.button>
  );
}
