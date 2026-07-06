import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/lib/seo";
import { format } from "date-fns";

const KO_STAGES = ["last-16", "quarter-finals", "semi-finals", "third-place", "final"] as const;
const KO_LABEL: Record<string, string> = {
  "last-16": "Round of 16",
  "quarter-finals": "Quarter-finals",
  "semi-finals": "Semi-finals",
  "third-place": "Third place",
  "final": "Final",
};

export default function Fixtures() {
  const [view, setView] = useState<"list" | "bracket">("list");
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

  const ko = KO_STAGES.map((stage) => ({
    stage,
    matches: data.filter((m) => m.stage === stage).sort((a, b) => a.date_utc.localeCompare(b.date_utc)),
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <Seo title="Fixtures — Pitch26" description="Complete schedule and knockout bracket for the 2026 FIFA World Cup." />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-5xl">Fixtures</h1>
          <p className="mt-2 text-muted-foreground">{data.length} World Cup matches. Times in your local timezone.</p>
        </div>
        <div className="inline-flex rounded-md border border-border bg-card/40 p-1 text-xs uppercase tracking-wider">
          {(["list", "bracket"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded px-4 py-2 font-bold transition ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >{v}</button>
          ))}
        </div>
      </div>

      {data.length === 0 && (
        <p className="mt-8 rounded-lg border border-border bg-card/40 p-6 text-sm text-muted-foreground">
          Schedule not loaded yet. Data auto-refreshes hourly.
        </p>
      )}

      {view === "list" && (
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
      )}

      {view === "bracket" && (
        <div className="mt-8 overflow-x-auto">
          <div className="flex min-w-max gap-6">
            {ko.map(({ stage, matches }) => (
              <div key={stage} className="flex min-w-[220px] flex-col justify-around gap-4">
                <h3 className="display text-center text-sm uppercase tracking-wider text-primary">{KO_LABEL[stage]}</h3>
                {matches.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border bg-card/20 p-4 text-center text-xs text-muted-foreground">
                    TBD
                  </div>
                )}
                {matches.map((m) => (
                  <div key={m.id} className="rounded-lg border border-border bg-card/60 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="display text-lg">{m.home_team_code ?? "TBD"}</span>
                      <span className="display text-primary">{m.home_score ?? "–"}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="display text-lg">{m.away_team_code ?? "TBD"}</span>
                      <span className="display text-primary">{m.away_score ?? "–"}</span>
                    </div>
                    <p className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {format(new Date(m.date_utc), "d MMM · HH:mm")}
                    </p>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs text-muted-foreground">Bracket populates as knockout matches are confirmed.</p>
        </div>
      )}
    </div>
  );
}
