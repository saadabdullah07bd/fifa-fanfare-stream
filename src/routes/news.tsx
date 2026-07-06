import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getNews } from "@/lib/data.functions";
import { format } from "date-fns";

export const Route = createFileRoute("/news")({
  head: () => ({
    meta: [
      { title: "News — Pitch26" },
      { name: "description", content: "Latest World Cup 2026 headlines from across the web." },
      { property: "og:title", content: "World Cup 2026 news" },
      { property: "og:description", content: "Curated headlines, refreshed hourly." },
    ],
  }),
  component: News,
});

function News() {
  const fn = useServerFn(getNews);
  const { data = [] } = useQuery({ queryKey: ["news"], queryFn: () => fn() });
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="display text-5xl">News</h1>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {data.length === 0 && <p className="text-sm text-muted-foreground">No news yet.</p>}
        {data.map((n) => (
          <a key={n.id} href={n.url} target="_blank" rel="noreferrer"
            className="group rounded-lg border border-border bg-card/40 p-5 hover:border-primary">
            <p className="text-xs uppercase tracking-wider text-primary">
              {n.source}{n.published_at ? ` · ${format(new Date(n.published_at), "d MMM")}` : ""}
            </p>
            <h2 className="mt-2 text-lg font-semibold group-hover:text-primary">{n.title}</h2>
            {n.summary && <p className="mt-2 text-sm text-muted-foreground">{n.summary}</p>}
          </a>
        ))}
      </div>
    </div>
  );
}
