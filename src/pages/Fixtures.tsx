import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/lib/seo";
import { flagUrl, bdDate, bdTime } from "@/lib/flags";

export default function Fixtures() {
  const { data = [] } = useQuery({
    queryKey: ["matches"],
    refetchInterval: 60_000,
    queryFn: async () => (await supabase.from("matches").select("*").order("date_utc")).data ?? [],
  });

  const sorted = useMemo(
    () => [...data].sort((a, b) => a.date_utc.localeCompare(b.date_utc)),
    [data],
  );
  const nextIdx = useMemo(() => {
    const now = Date.now();
    const i = sorted.findIndex((m) => new Date(m.date_utc).getTime() >= now);
    return i === -1 ? Math.max(0, sorted.length - 1) : i;
  }, [sorted]);

  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    if (!sorted.length) return;
    const el = cardRefs.current[nextIdx];
    if (el) el.scrollIntoView({ block: "start" });
  }, [sorted.length, nextIdx]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Seo title="Fixtures — Pitch26" description="Every 2026 FIFA World Cup fixture. Scroll for the next or previous match." />
      <div className="mb-4">
        <h1 className="display text-4xl">Fixtures</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Scroll to see the next or previous match. Times shown in Bangladesh time (GMT+6).
        </p>
      </div>

      {sorted.length === 0 && (
        <p className="rounded-lg border border-border bg-card/40 p-6 text-sm text-muted-foreground">
          Schedule not loaded yet. Data auto-refreshes hourly.
        </p>
      )}

      <div
        ref={containerRef}
        className="snap-y snap-mandatory overflow-y-auto rounded-xl border border-border bg-card/20"
        style={{ height: "calc(100vh - 220px)" }}
      >
        {sorted.map((m, i) => {
          const upcoming = new Date(m.date_utc).getTime() > Date.now();
          const isNext = i === nextIdx;
          return (
            <article
              key={m.id}
              ref={(el) => (cardRefs.current[i] = el)}
              className="flex h-full min-h-full snap-start flex-col justify-center p-6"
              style={{ height: "calc(100vh - 220px)" }}
            >
              <div className="mx-auto flex w-full max-w-2xl flex-col items-center">
                <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-primary">
                  {isNext && upcoming && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary">Next up</span>}
                  {m.status === "live" && <span className="rounded-full bg-accent/20 px-2 py-0.5 text-accent"><span className="live-dot mr-1 align-middle" />Live</span>}
                  <span>{m.stage ?? "Group stage"}</span>
                </div>
                <p className="mt-4 text-center text-sm text-muted-foreground">{bdDate(m.date_utc)}</p>
                <p className="text-center display text-3xl text-primary">{bdTime(m.date_utc)}</p>

                <div className="mt-8 grid w-full grid-cols-[1fr_auto_1fr] items-center gap-6">
                  <TeamSide code={m.home_team_code} align="right" />
                  <span className="display text-4xl text-muted-foreground">
                    {m.status === "scheduled" ? "vs" : `${m.home_score ?? 0}–${m.away_score ?? 0}`}
                  </span>
                  <TeamSide code={m.away_team_code} align="left" />
                </div>

                {m.venue && (
                  <p className="mt-8 text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">{m.venue}</p>
                )}
                <p className="mt-6 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
                  Match {i + 1} of {sorted.length} · scroll ↑ ↓
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function TeamSide({ code, align }: { code: string | null; align: "left" | "right" }) {
  const url = flagUrl(code, 160);
  return (
    <div className={`flex flex-col items-center ${align === "right" ? "md:items-end" : "md:items-start"}`}>
      {url ? (
        <img src={url} alt={code ?? "TBD"} loading="lazy"
          className="h-16 w-24 rounded-sm object-cover shadow-sm ring-1 ring-border" />
      ) : (
        <div className="grid h-16 w-24 place-items-center rounded-sm bg-card/60 text-xs text-muted-foreground">TBD</div>
      )}
      <span className="mt-3 display text-2xl">{code ?? "TBD"}</span>
    </div>
  );
}
