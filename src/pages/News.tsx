import { useQuery } from "@tanstack/react-query";
import { Seo } from "@/lib/seo";
import { formatDistanceToNow } from "date-fns";

type Article = {
  id: string; title: string; url: string; source: string;
  summary: string; image_url: string | null; published_at: string | null;
};

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/news-feed`;

export default function News() {
  const { data, isLoading } = useQuery({
    queryKey: ["news-feed"],
    refetchInterval: 300_000,
    queryFn: async () => {
      const res = await fetch(FN_URL, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } });
      return res.json() as Promise<{ articles: Article[] }>;
    },
  });
  const articles = data?.articles ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <Seo title="News — Pitch26" description="Latest World Cup 2026 and football headlines, live from Google News." />
      <h1 className="display text-5xl">News</h1>
      <p className="mt-2 text-muted-foreground">Live headlines from across the web. Refreshes every 5 minutes.</p>

      {isLoading && <p className="mt-8 text-sm text-muted-foreground">Loading headlines…</p>}
      {!isLoading && articles.length === 0 && (
        <p className="mt-8 text-sm text-muted-foreground">No headlines available right now.</p>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {articles.map((n) => (
          <a key={n.id} href={n.url} target="_blank" rel="noreferrer" className="group rounded-lg border border-border bg-card/40 p-5 transition hover:border-primary">
            <p className="text-xs uppercase tracking-wider text-primary">
              {n.source}{n.published_at ? ` · ${formatDistanceToNow(new Date(n.published_at), { addSuffix: true })}` : ""}
            </p>
            <h2 className="mt-2 text-lg font-semibold group-hover:text-primary">{n.title}</h2>
            {n.summary && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{n.summary}</p>}
          </a>
        ))}
      </div>
    </div>
  );
}
