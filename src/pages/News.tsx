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

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-12">
      <Seo title="News — Pitch26" description="Latest World Cup 2026 and football headlines, live." />
      <h1 className="display text-4xl sm:text-5xl">The Daily Pitch</h1>
      <p className="mt-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">Live headlines</p>
      <div className="mt-4 h-px w-full bg-border" />

      {isLoading && <p className="mt-8 text-sm text-muted-foreground">Loading headlines…</p>}
      {isError && (
        <p className="mt-8 text-sm text-destructive">
          {(error as Error).message || "Could not load headlines right now."}
        </p>
      )}
      {!isLoading && articles.length === 0 && (
        <p className="mt-8 text-sm text-muted-foreground">No headlines available right now.</p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((n) => (
          <a
            key={n.id}
            href={n.url}
            target="_blank"
            rel="noreferrer"
            className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card/40 transition hover:border-primary"
          >
            {n.image_url ? (
              <img
                src={n.image_url}
                alt=""
                loading="lazy"
                className="aspect-[16/10] w-full object-cover"
              />
            ) : (
              <div className="aspect-[16/10] w-full bg-gradient-to-br from-primary/10 to-secondary/40" />
            )}
            <div className="flex flex-1 flex-col p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-primary">
                {n.source}
                {n.published_at ? ` · ${formatDistanceToNow(new Date(n.published_at), { addSuffix: true })}` : ""}
              </p>
              <h3 className="mt-2 text-base font-semibold leading-snug group-hover:text-primary">
                {n.title}
              </h3>
              {n.summary && (
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{n.summary}</p>
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
