import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/lib/seo";

export default function Teams() {
  const { data = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => (await supabase.from("teams").select("*").order("name")).data ?? [],
  });
  const byConf = data.reduce<Record<string, typeof data>>((a, t) => {
    const k = t.confederation ?? "Other";
    (a[k] ||= []).push(t);
    return a;
  }, {});
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <Seo title="Teams — Pitch26" description="All qualified nations for the 2026 FIFA World Cup." />
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
