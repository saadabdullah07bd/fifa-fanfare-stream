import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/lib/seo";

export default function Venues() {
  const { data = [] } = useQuery({
    queryKey: ["venues"],
    queryFn: async () => (await supabase.from("venues").select("*").order("country").order("city")).data ?? [],
  });
  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <Seo title="Host venues — Pitch26" description="The 16 host cities of the 2026 FIFA World Cup." />
      <h1 className="display text-5xl">Host venues</h1>
      <p className="mt-2 text-muted-foreground">{data.length} stadiums across three countries. Tap a stadium for details.</p>
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((v) => (
          <Link
            key={v.id}
            to={`/venues/${v.id}`}
            className="group overflow-hidden rounded-lg border border-border bg-card/40 transition hover:border-primary"
          >
            {v.image_url && <img src={v.image_url} alt={v.name} loading="lazy" className="h-48 w-full object-cover" />}
            <div className="p-4">
              <p className="text-xs uppercase tracking-wider text-primary">{v.country}</p>
              <h2 className="display mt-1 text-2xl group-hover:text-primary">{v.name}</h2>
              <p className="text-sm text-muted-foreground">
                {v.city}{v.capacity ? ` · ${v.capacity.toLocaleString()} cap.` : ""}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
