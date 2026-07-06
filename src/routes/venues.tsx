import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getVenues } from "@/lib/data.functions";

export const Route = createFileRoute("/venues")({
  head: () => ({
    meta: [
      { title: "Host venues — Pitch26" },
      { name: "description", content: "The 16 host cities of the 2026 FIFA World Cup." },
      { property: "og:title", content: "World Cup 2026 venues" },
      { property: "og:description", content: "Stadiums across USA, Canada and Mexico." },
    ],
  }),
  component: Venues,
});

function Venues() {
  const fn = useServerFn(getVenues);
  const { data = [] } = useQuery({ queryKey: ["venues"], queryFn: () => fn() });
  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <h1 className="display text-5xl">Host venues</h1>
      <p className="mt-2 text-muted-foreground">{data.length} stadiums across three countries.</p>
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((v) => (
          <article key={v.id} className="overflow-hidden rounded-lg border border-border bg-card/40">
            {v.image_url && <img src={v.image_url} alt={v.name} loading="lazy" className="h-48 w-full object-cover" />}
            <div className="p-4">
              <p className="text-xs uppercase tracking-wider text-primary">{v.country}</p>
              <h2 className="display mt-1 text-2xl">{v.name}</h2>
              <p className="text-sm text-muted-foreground">{v.city}{v.capacity ? ` · ${v.capacity.toLocaleString()} cap.` : ""}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
