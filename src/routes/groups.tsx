import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getGroups } from "@/lib/data.functions";

export const Route = createFileRoute("/groups")({
  head: () => ({
    meta: [
      { title: "Groups & standings — Pitch26" },
      { name: "description", content: "All 12 groups and live standings for the 2026 World Cup." },
      { property: "og:title", content: "World Cup 2026 groups" },
      { property: "og:description", content: "12 groups, 48 teams." },
    ],
  }),
  component: Groups,
});

function Groups() {
  const fn = useServerFn(getGroups);
  const { data } = useQuery({ queryKey: ["groups"], queryFn: () => fn(), refetchInterval: 60_000 });

  const teams = data?.teams ?? [];
  const standings = data?.standings ?? [];

  // Group teams by their "group" field; fall back to grouping standings.
  const byGroup: Record<string, Array<typeof teams[number]>> = {};
  for (const t of teams) {
    if (!t.group) continue;
    (byGroup[t.group] ||= []).push(t);
  }
  const groupLetters = Object.keys(byGroup).sort();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="display text-5xl">Groups</h1>
      <p className="mt-2 text-muted-foreground">The 48-team draw. Top two + best thirds advance.</p>

      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {groupLetters.map((letter) => {
          const groupTeams = byGroup[letter];
          const groupStandings = standings.filter((s) => s.group === letter);
          const rows = groupTeams
            .map((t) => {
              const s = groupStandings.find((st) => st.team_code === t.code);
              return { team: t, s: s ?? { played: 0, w: 0, d: 0, l: 0, gd: 0, pts: 0 } };
            })
            .sort((a, b) => (b.s.pts ?? 0) - (a.s.pts ?? 0) || (b.s.gd ?? 0) - (a.s.gd ?? 0));
          return (
            <div key={letter} className="rounded-lg border border-border bg-card/40 p-4">
              <h2 className="display text-2xl text-primary">Group {letter}</h2>
              <table className="mt-3 w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr><th className="text-left">Team</th><th>P</th><th>GD</th><th className="text-right">Pts</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.team.code} className="border-t border-border/50">
                      <td className="flex items-center gap-2 py-2">
                        {r.team.flag_url && <img src={r.team.flag_url} alt="" className="h-4 w-6 rounded-sm object-cover" />}
                        <span>{r.team.name}</span>
                      </td>
                      <td className="text-center tabular-nums">{r.s.played}</td>
                      <td className="text-center tabular-nums">{r.s.gd}</td>
                      <td className="text-right display text-primary">{r.s.pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}
