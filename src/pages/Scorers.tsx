import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/lib/seo";

export default function Scorers() {
  const { data = [] } = useQuery({
    queryKey: ["scorers"],
    refetchInterval: 60_000,
    queryFn: async () => (await supabase.from("scorers").select("*").order("goals", { ascending: false }).limit(50)).data ?? [],
  });
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Seo title="Top scorers — Pitch26" description="Golden Boot race for the 2026 FIFA World Cup." />
      <h1 className="display text-5xl">Golden Boot</h1>
      <ol className="mt-8 divide-y divide-border rounded-lg border border-border bg-card/40">
        {data.length === 0 && <li className="p-6 text-sm text-muted-foreground">No goals scored yet.</li>}
        {data.map((s, i) => (
          <li key={s.id} className="flex items-center gap-4 p-4">
            <span className="display w-8 text-2xl text-primary">{i + 1}</span>
            <span className="flex-1 font-semibold">{s.player}</span>
            <span className="text-xs uppercase tracking-wider text-muted-foreground">{s.team_code}</span>
            <span className="display text-3xl text-primary">{s.goals}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
