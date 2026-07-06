import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getTeams } from "@/lib/data.functions";

export const Route = createFileRoute("/teams")({
  head: () => ({
    meta: [
      { title: "Teams — Pitch26" },
      { name: "description", content: "All qualified nations for the 2026 FIFA World Cup." },
      { property: "og:title", content: "World Cup 2026 teams" },
      { property: "og:description", content: "48 nations, six confederations." },
    ],
  }),
  component: Teams,
});

function Teams() {
  const fn = useServerFn(getTeams);
  const { data = [] } = useQuery({ queryKey: ["teams"], queryFn: () => fn() });

  const byConf = data.reduce<Record<string, typeof data>>((a, t) => {
    const k = t.confederation ?? "Other";
    (a[k] ||= []).push(t);
    return a;
  }, {});

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="display text-5xl">Teams</h1>
      <p className="mt-2 text-muted-foreground">{data.length} nations qualified.</p>
      <div className="mt-8 space-y-8">
        {Object.entries(byConf).map(([conf, teams]) => (
          <section key={conf}>
            <h2 className="display text-2xl text-primary">{conf}</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {teams.map((t) => (
                <div key={t.code} className="flex items-center gap-3 rounded-lg border border-border bg-card/40 p-3">
                  {t.flag_url && <img src={t.flag_url} alt={t.name} className="h-6 w-9 rounded-sm object-cover" />}
                  <div>
                    <p className="font-semibold">{t.name}</p>
                    <p className="text-xs text-muted-foreground">Group {t.group ?? "?"}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
