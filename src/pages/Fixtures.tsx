import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/lib/seo";
import { format } from "date-fns";

export default function Fixtures() {
  const { data = [] } = useQuery({
    queryKey: ["matches"],
    refetchInterval: 60_000,
    queryFn: async () => (await supabase.from("matches").select("*").order("date_utc")).data ?? [],
  });

  const grouped = data.reduce<Record<string, typeof data>>((acc, m) => {
    const d = format(new Date(m.date_utc), "EEEE d MMMM yyyy");
    (acc[d] ||= []).push(m);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <Seo title="Fixtures — Pitch26" description="Complete schedule for the 2026 FIFA World Cup." />
      <h1 className="display text-5xl">Fixtures</h1>
      <p className="mt-2 text-muted-foreground">{data.length} matches. Times shown in your local timezone.</p>
      {data.length === 0 && (
        <p className="mt-8 rounded-lg border border-border bg-card/40 p-6 text-sm text-muted-foreground">
          Schedule not loaded yet. Data auto-refreshes hourly.
        </p>
      )}
      <div className="mt-8 space-y-8">
        {Object.entries(grouped).map(([day, matches]) => (
          <section key={day}>
            <h2 className="display text-xl text-primary">{day}</h2>
            <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-card/40">
              {matches.map((m) => (
                <li key={m.id} className="flex items-center gap-4 p-4">
                  <span className="w-16 text-sm tabular-nums text-muted-foreground">{format(new Date(m.date_utc), "HH:mm")}</span>
                  <span className="display flex-1 text-right text-xl">{m.home_team_code ?? "TBD"}</span>
                  <span className="display min-w-[60px] text-center text-xl text-primary">
                    {m.status === "scheduled" ? "v" : `${m.home_score}–${m.away_score}`}
                  </span>
                  <span className="display flex-1 text-xl">{m.away_team_code ?? "TBD"}</span>
                  <span className="w-20 text-right text-xs uppercase tracking-wider text-muted-foreground">
                    {m.status === "live" ? <><span className="live-dot mr-1 align-middle" />Live</> : m.status}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
