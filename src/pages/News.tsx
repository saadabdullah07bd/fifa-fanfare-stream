import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/lib/seo";
import { format } from "date-fns";

export default function News() {
  const { data = [] } = useQuery({
    queryKey: ["news"],
    queryFn: async () => (await supabase.from("news").select("*").order("published_at", { ascending: false }).limit(30)).data ?? [],
  });
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <Seo title="News — Pitch26" description="Latest World Cup 2026 headlines from across the web." />
      <h1 className="display text-5xl">News</h1>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {data.length === 0 && <p className="text-sm text-muted-foreground">No news yet.</p>}
        {data.map((n) => (
          <a key={n.id} href={n.url} target="_blank" rel="noreferrer" className="group rounded-lg border border-border bg-card/40 p-5 hover:border-primary">
            <p className="text-xs uppercase tracking-wider text-primary">
              {n.source}{n.published_at ? ` · ${format(new Date(n.published_at), "d MMM")}` : ""}
            </p>
            <h2 className="mt-2 text-lg font-semibold group-hover:text-primary">{n.title}</h2>
            {n.image_url && <img src={n.image_url} alt="" loading="lazy" className="mt-3 h-40 w-full rounded object-cover" />}
            {n.summary && <p className="mt-2 text-sm text-muted-foreground">{n.summary}</p>}
          </a>
        ))}
      </div>
    </div>
  );
}
