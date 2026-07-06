import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Seo } from "@/lib/seo";

async function fetchWiki(title: string) {
  const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
  if (!res.ok) throw new Error("wiki miss");
  return res.json() as Promise<{
    title: string; extract: string; description?: string;
    thumbnail?: { source: string };
    originalimage?: { source: string };
    content_urls?: { desktop: { page: string } };
  }>;
}

export default function TeamDetail() {
  const { name } = useParams();
  const decoded = decodeURIComponent(name ?? "");

  const { data, isLoading } = useQuery({
    queryKey: ["wiki-team", decoded],
    enabled: !!decoded,
    queryFn: async () => {
      // Try dedicated national team article first, then fall back to plain name.
      try {
        return await fetchWiki(`${decoded} national football team`);
      } catch {
        try { return await fetchWiki(`${decoded} national soccer team`); }
        catch { return await fetchWiki(decoded); }
      }
    },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <Seo
        title={`${decoded} — Pitch26`}
        description={data?.description ?? `${decoded} — football team profile.`}
        path={`/team/${encodeURIComponent(decoded)}`}
      />
      <Link to="/" className="text-xs uppercase tracking-wider text-primary">← Home</Link>
      <h1 className="display mt-2 text-5xl">{decoded}</h1>
      {data?.description && <p className="mt-1 text-muted-foreground">{data.description}</p>}

      {data?.thumbnail?.source && (
        <img src={data.originalimage?.source ?? data.thumbnail.source} alt={decoded} className="mt-6 max-h-96 w-full rounded-lg border border-border object-cover" />
      )}

      <section className="mt-8 rounded-lg border border-border bg-card/40 p-6">
        <h2 className="display text-2xl text-primary">About</h2>
        {isLoading && <p className="mt-3 text-sm text-muted-foreground">Loading from Wikipedia…</p>}
        {data && (
          <>
            <p className="mt-3 whitespace-pre-line text-foreground/90">{data.extract}</p>
            {data.content_urls?.desktop.page && (
              <a href={data.content_urls.desktop.page} target="_blank" rel="noreferrer" className="mt-4 inline-block text-xs uppercase tracking-wider text-primary">
                Read on Wikipedia →
              </a>
            )}
          </>
        )}
        {!isLoading && !data && <p className="mt-3 text-sm text-muted-foreground">No Wikipedia entry found.</p>}
      </section>
    </div>
  );
}
