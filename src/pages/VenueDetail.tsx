import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/lib/seo";

async function fetchWiki(title: string) {
  const res = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
  );
  if (!res.ok) throw new Error("wiki miss");
  return res.json() as Promise<{
    title: string;
    extract: string;
    thumbnail?: { source: string };
    content_urls?: { desktop: { page: string } };
  }>;
}

export default function VenueDetail() {
  const { id } = useParams();

  const { data: venue } = useQuery({
    queryKey: ["venue", id],
    enabled: !!id,
    queryFn: async () =>
      (await supabase.from("venues").select("*").eq("id", id!).maybeSingle()).data,
  });

  const { data: wiki, isLoading: wikiLoading } = useQuery({
    queryKey: ["wiki", venue?.name, venue?.city],
    enabled: !!venue?.name,
    queryFn: async () => {
      try {
        return await fetchWiki(venue!.name);
      } catch {
        return await fetchWiki(`${venue!.name} (${venue!.city})`);
      }
    },
  });

  const { data: matches = [] } = useQuery({
    queryKey: ["venue-matches", id],
    enabled: !!id,
    queryFn: async () =>
      (await supabase.from("matches").select("*").eq("venue_id", id!).order("date_utc")).data ?? [],
  });

  if (!venue) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <p className="text-muted-foreground">Loading venue…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <Seo title={`${venue.name} — Pitch26`} description={`${venue.name} in ${venue.city}, ${venue.country}. World Cup 2026 host venue.`} />
      <Link to="/venues" className="text-xs uppercase tracking-wider text-primary">← All venues</Link>
      <h1 className="display mt-2 text-5xl">{venue.name}</h1>
      <p className="mt-1 text-muted-foreground">
        {venue.city} · {venue.country}
        {venue.capacity ? ` · ${venue.capacity.toLocaleString()} capacity` : ""}
      </p>

      {(wiki?.thumbnail?.source || venue.image_url) && (
        <img
          src={wiki?.thumbnail?.source ?? venue.image_url ?? ""}
          alt={venue.name}
          className="mt-6 w-full max-h-96 rounded-lg border border-border object-cover"
        />
      )}

      <section className="mt-8 rounded-lg border border-border bg-card/40 p-6">
        <h2 className="display text-2xl text-primary">About</h2>
        {wikiLoading && <p className="mt-3 text-sm text-muted-foreground">Loading from Wikipedia…</p>}
        {wiki && (
          <>
            <p className="mt-3 whitespace-pre-line text-foreground/90">{wiki.extract}</p>
            {wiki.content_urls?.desktop.page && (
              <a
                href={wiki.content_urls.desktop.page}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-block text-xs uppercase tracking-wider text-primary"
              >
                Read on Wikipedia →
              </a>
            )}
          </>
        )}
        {!wikiLoading && !wiki && (
          <p className="mt-3 text-sm text-muted-foreground">No Wikipedia entry found.</p>
        )}
      </section>

      {matches.length > 0 && (
        <section className="mt-8">
          <h2 className="display text-2xl text-primary">Matches here</h2>
          <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-card/40">
            {matches.map((m) => (
              <li key={m.id} className="flex items-center gap-4 p-4">
                <span className="w-40 text-xs uppercase tracking-wider text-muted-foreground">
                  {new Date(m.date_utc).toLocaleString()}
                </span>
                <span className="display flex-1 text-right text-lg">{m.home_team_code ?? "TBD"}</span>
                <span className="display text-primary">
                  {m.status === "scheduled" ? "v" : `${m.home_score}–${m.away_score}`}
                </span>
                <span className="display flex-1 text-lg">{m.away_team_code ?? "TBD"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
