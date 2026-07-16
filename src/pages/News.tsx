import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Seo } from "@/lib/seo";
import { formatDistanceToNow } from "date-fns";
import { Newspaper, ArrowUpRight, Radio, Search } from "lucide-react";

type Article = {
  id: string;
  title: string;
  url: string;
  source: string;
  summary: string;
  image_url: string | null;
  published_at: string | null;
};

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/news-feed`;

function timeAgo(iso: string | null) {
  if (!iso) return "";
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "";
  }
}

/**
 * Full news feed page displaying the latest football headlines.
 * Premium Broadcast magazine-bento layout with hero, secondary tiles, and grid.
 */
export default function News() {
  const [query, setQuery] = useState("");
  const [activeSource, setActiveSource] = useState<string>("All");

  const { data, isLoading, isError, error, isFetching, refetch } = useQuery({
    queryKey: ["news-feed"],
    refetchInterval: 3600_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await fetch(`${FN_URL}?t=${Math.floor(Date.now() / 3600_000)}`, {
        headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      });
      if (!res.ok) throw new Error(`News request failed (${res.status})`);
      return res.json() as Promise<{ articles: Article[] }>;
    },
  });

  const articles = data?.articles ?? [];

  const sources = useMemo(() => {
    const set = new Set<string>();
    articles.forEach((a) => a.source && set.add(a.source));
    return ["All", ...Array.from(set).slice(0, 8)];
  }, [articles]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return articles.filter((a) => {
      const matchesSource = activeSource === "All" || a.source === activeSource;
      const matchesQuery =
        !q ||
        a.title.toLowerCase().includes(q) ||
        a.summary?.toLowerCase().includes(q) ||
        a.source?.toLowerCase().includes(q);
      return matchesSource && matchesQuery;
    });
  }, [articles, query, activeSource]);

  const [hero, ...rest] = filtered;
  const secondary = rest.slice(0, 2);
  const remaining = rest.slice(2);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 pb-16 sm:py-8">
      <Seo
        title="FIFA World Cup 2026 News, Team Updates & Match Reports | Pitch26"
        description="Latest FIFA World Cup 2026 news, team announcements, injury updates and match reports — updated live from top football sources."
        path="/news"
      />

      {/* Editorial header */}
      <header className="hero-sweep relative overflow-hidden rounded-3xl border border-border bg-card/60 p-5 sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(60% 80% at 100% 0%, rgba(var(--primary-rgb), 0.18), transparent 60%), radial-gradient(50% 70% at 0% 100%, rgba(var(--trophy-green-rgb), 0.25), transparent 60%)",
          }}
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-primary">
              <Radio className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Live wire · World Cup 2026</span>
              {isFetching && (
                <span className="ml-2 inline-flex items-center gap-1 text-muted-foreground">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/70" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                  </span>
                  refreshing
                </span>
              )}
            </div>
            <h1 className="display mt-2 text-4xl leading-none sm:text-6xl md:text-7xl">
              The Daily Pitch
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Headlines, team updates and match reports — curated from the world's best football
              desks.
            </p>
          </div>

          {/* Search */}
          <div className="w-full sm:w-72">
            <label htmlFor="news-search" className="sr-only">
              Search headlines
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                id="news-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search headlines…"
                className="h-11 w-full rounded-full border border-border bg-background/70 pl-9 pr-4 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Source filter chips */}
        {sources.length > 1 && (
          <nav
            aria-label="Filter by source"
            className="relative mt-5 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {sources.map((s) => {
              const active = activeSource === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setActiveSource(s)}
                  aria-pressed={active}
                  className={`shrink-0 rounded-full border px-4 py-2 text-xs uppercase tracking-[0.18em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background/50 text-muted-foreground hover:border-primary/60 hover:text-foreground"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </nav>
        )}
      </header>

      {/* States */}
      {isLoading && (
        <div
          role="status"
          aria-live="polite"
          className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-12"
        >
          <div className="h-[420px] animate-pulse rounded-3xl bg-card/40 md:col-span-8" />
          <div className="hidden gap-5 md:col-span-4 md:grid">
            <div className="h-[200px] animate-pulse rounded-3xl bg-card/40" />
            <div className="h-[200px] animate-pulse rounded-3xl bg-card/40" />
          </div>
          <span className="sr-only">Loading headlines…</span>
        </div>
      )}

      {isError && (
        <div className="mt-6 rounded-3xl border border-destructive/40 bg-destructive/10 p-6 text-center">
          <p className="text-sm text-destructive">
            {(error as Error)?.message || "Could not load headlines right now."}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 rounded-full border border-destructive/40 px-4 py-2 text-xs uppercase tracking-[0.2em] text-destructive hover:bg-destructive/10"
          >
            Try again
          </button>
        </div>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <div className="mt-6 rounded-3xl border border-border bg-card/40 p-10 text-center">
          <Newspaper className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm text-muted-foreground">
            No headlines match your filters right now.
          </p>
        </div>
      )}

      {/* Bento layout */}
      {!isLoading && !isError && filtered.length > 0 && (
        <>
          <section
            aria-label="Featured headlines"
            className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-12"
          >
            {hero && <HeroCard article={hero} />}
            {secondary.length > 0 && (
              <div className="grid gap-5 md:col-span-4">
                {secondary.map((a) => (
                  <SecondaryCard key={a.id} article={a} />
                ))}
              </div>
            )}
          </section>

          {remaining.length > 0 && (
            <section aria-label="Latest headlines" className="mt-8">
              <div className="mb-4 flex items-baseline justify-between">
                <h2 className="display text-2xl sm:text-3xl">Latest</h2>
                <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  {remaining.length} stories
                </span>
              </div>
              <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {remaining.map((n) => (
                  <li key={n.id} className="h-full">
                    <ArticleCard article={n} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

/* ---------- Card variants ---------- */

function HeroCard({ article }: { article: Article }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noreferrer"
      aria-label={`Read: ${article.title}`}
      className="group relative flex min-h-[360px] flex-col justify-end overflow-hidden rounded-3xl border border-border bg-card md:col-span-8 md:min-h-[460px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {article.image_url ? (
        <img
          src={article.image_url}
          alt=""
          loading="eager"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-secondary/40" />
      )}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent"
      />
      <div className="relative p-6 sm:p-8">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-primary">
          <span className="rounded-full bg-primary/15 px-2.5 py-1">Top story</span>
          <span className="text-muted-foreground">
            {article.source}
            {article.published_at ? ` · ${timeAgo(article.published_at)}` : ""}
          </span>
        </div>
        <h2 className="display mt-3 max-w-3xl text-2xl leading-tight sm:text-4xl md:text-5xl">
          {article.title}
        </h2>
        {article.summary && (
          <p className="mt-3 line-clamp-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            {article.summary}
          </p>
        )}
        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
          Read story
          <ArrowUpRight
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            aria-hidden="true"
          />
        </span>
      </div>
    </a>
  );
}

function SecondaryCard({ article }: { article: Article }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noreferrer"
      aria-label={`Read: ${article.title}`}
      className="group card-lift relative flex min-h-[200px] items-end overflow-hidden rounded-3xl border border-border bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {article.image_url ? (
        <img
          src={article.image_url}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-secondary/40" />
      )}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent"
      />
      <div className="relative p-5">
        <p className="text-[10px] uppercase tracking-[0.22em] text-primary">
          {article.source}
          {article.published_at ? ` · ${timeAgo(article.published_at)}` : ""}
        </p>
        <h3 className="mt-1.5 line-clamp-3 text-lg font-semibold leading-snug group-hover:text-primary">
          {article.title}
        </h3>
      </div>
    </a>
  );
}

function ArticleCard({ article }: { article: Article }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noreferrer"
      aria-label={`Read: ${article.title}`}
      className="group card-lift flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden">
        {article.image_url ? (
          <img
            src={article.image_url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary/10 to-secondary/40" />
        )}
      </div>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <p className="text-[10px] uppercase tracking-[0.22em] text-primary">
          {article.source}
          {article.published_at ? ` · ${timeAgo(article.published_at)}` : ""}
        </p>
        <h3 className="mt-2 line-clamp-3 text-base font-semibold leading-snug group-hover:text-primary">
          {article.title}
        </h3>
        {article.summary && (
          <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{article.summary}</p>
        )}
        <span className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Read
          <ArrowUpRight
            className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            aria-hidden="true"
          />
        </span>
      </div>
    </a>
  );
}
