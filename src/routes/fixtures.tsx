import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAllMatches } from "@/lib/data.functions";
import { format } from "date-fns";

export const Route = createFileRoute("/fixtures")({
  head: () => ({
    meta: [
      { title: "Fixtures — Pitch26" },
      { name: "description", content: "Complete schedule for the 2026 FIFA World Cup." },
      { property: "og:title", content: "World Cup 2026 fixtures" },
      { property: "og:description", content: "Every kick-off across the 48-team tournament." },
    ],
  }),
  component: Fixtures,
});

function Fixtures() {
  const fn = useServerFn(getAllMatches);
  const { data = [] } = useQuery({ queryKey: ["matches"], queryFn: () => fn(), refetchInterval: 60_000 });

  const grouped = data.reduce<Record<string, typeof data>>((acc, m) => {
    const d = format(new Date(m.date_utc), "EEEE d MMMM yyyy");
    (acc[d] ||= []).push(m);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="display text-5xl">Fixtures</h1>
      <p className="mt-2 text-muted-foreground">{data.length} matches. Times shown in your local timezone.</p>
      {data.length === 0 && (
        <p className="mt-8 rounded-lg border border-border bg-card/40 p-6 text-sm text-muted-foreground">
          Schedule not loaded yet. From the home page, click "Refresh now" to pull the latest fixtures.
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
