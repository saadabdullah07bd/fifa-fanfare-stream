import { useQuery } from "@tanstack/react-query";
import { Seo } from "@/lib/seo";
import { formatDistanceToNow } from "date-fns";

type Article = {
  id: string; title: string; url: string; source: string;
  summary: string; image_url: string | null; published_at: string | null;
};

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/news-feed`;

export default function News() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["news-feed"],
    refetchInterval: 120_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const res = await fetch(`${FN_URL}?t=${Math.floor(Date.now() / 120_000)}`, {
        headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      });
      if (!res.ok) throw new Error(`News request failed (${res.status})`);
      return res.json() as Promise<{ articles: Article[] }>;
    },
  });
  const articles = data?.articles ?? [];
  const [lead, ...rest] = articles;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 font-serif">
      <Seo title="News — Pitch26" description="Latest World Cup 2026 and football headlines, live." />
      <h1 className="font-serif text-5xl font-black tracking-tight">The Daily Pitch</h1>
      <p className="mt-2 font-sans text-sm uppercase tracking-[0.2em] text-muted-foreground">Live headlines</p>
      <div className="mt-6 h-px w-full bg-border" />

      {isLoading && <p className="mt-8 font-sans text-sm text-muted-foreground">Loading headlines…</p>}
      {isError && (
        <p className="mt-8 font-sans text-sm text-destructive">
          {(error as Error).message || "Could not load headlines right now."}
        </p>
      )}
      {!isLoading && articles.length === 0 && (
        <p className="mt-8 font-sans text-sm text-muted-foreground">No headlines available right now.</p>
      )}

      {lead && (
        <a href={lead.url} target="_blank" rel="noreferrer" className="mt-8 block group">
          <div className="grid gap-6 md:grid-cols-2">
            {lead.image_url ? (
              <img src={lead.image_url} alt="" loading="lazy"
                className="aspect-[16/10] w-full rounded-lg object-cover" />
            ) : (
              <div className="aspect-[16/10] w-full rounded-lg bg-card/40" />
            )}
            <div>
              <p className="font-sans text-xs uppercase tracking-[0.2em] text-primary">
                {lead.source}{lead.published_at ? ` · ${formatDistanceToNow(new Date(lead.published_at), { addSuffix: true })}` : ""}
              </p>
              <h2 className="mt-3 font-serif text-3xl font-bold leading-tight group-hover:text-primary">{lead.title}</h2>
              {lead.summary && <p className="mt-3 font-serif text-base leading-relaxed text-muted-foreground">{lead.summary}</p>}
            </div>
          </div>
        </a>
      )}

      <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {rest.map((n) => (
          <a key={n.id} href={n.url} target="_blank" rel="noreferrer" className="group block">
            {n.image_url ? (
              <img src={n.image_url} alt="" loading="lazy"
                className="mb-3 aspect-[16/10] w-full rounded-md object-cover" />
            ) : (
              <div className="mb-3 aspect-[16/10] w-full rounded-md bg-card/40" />
            )}
            <p className="font-sans text-[11px] uppercase tracking-[0.2em] text-primary">
              {n.source}{n.published_at ? ` · ${formatDistanceToNow(new Date(n.published_at), { addSuffix: true })}` : ""}
            </p>
            <h3 className="mt-2 font-serif text-xl font-semibold leading-snug group-hover:text-primary">{n.title}</h3>
            {n.summary && <p className="mt-2 line-clamp-3 font-serif text-sm text-muted-foreground">{n.summary}</p>}
          </a>
        ))}
      </div>
    </div>
  );
}
