import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getScorers } from "@/lib/data.functions";

export const Route = createFileRoute("/scorers")({
  head: () => ({
    meta: [
      { title: "Top scorers — Pitch26" },
      { name: "description", content: "Golden Boot race for the 2026 FIFA World Cup." },
      { property: "og:title", content: "World Cup 2026 top scorers" },
      { property: "og:description", content: "Live Golden Boot standings." },
    ],
  }),
  component: Scorers,
});

function Scorers() {
  const fn = useServerFn(getScorers);
  const { data = [] } = useQuery({ queryKey: ["scorers"], queryFn: () => fn(), refetchInterval: 60_000 });
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
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
