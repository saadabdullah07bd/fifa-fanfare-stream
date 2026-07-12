import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

type Row = {
  position: number;
  team: { name: string; tla?: string; crest?: string };
  played: number; won: number; draw: number; lost: number;
  points: number; gf: number; ga: number; gd: number; form?: string;
};
type Group = { group: string | null; stage: string; type: string; table: Row[] };
type Scorer = {
  player: { name: string; nationality?: string };
  team: { name: string; tla?: string; crest?: string };
  goals: number; assists?: number; penalties?: number; played?: number;
};

function titleCase(value: string) {
  return value.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function cleanCompetitionLabel(value: string | null | undefined) {
  return (value ?? "")
    .replace(/^GROUP[_\s-]*/i, "")
    .replace(/_/g, " ")
    .trim();
}

function groupTitle(group: string | null | undefined, stage: string | null | undefined) {
  const label = cleanCompetitionLabel(group || stage);
  if (!label) return "Group";
  if (/^group\b/i.test(label)) return titleCase(label);
  return `Group ${titleCase(label)}`;
}

function stageTitle(stage: string | null | undefined) {
  const label = (stage ?? "").replace(/_/g, " ").trim();
  return label ? titleCase(label) : "";
}

export default function Standings() {
  const [tab, setTab] = useState<"standings" | "scorers">("standings");
  const [groups, setGroups] = useState<Group[]>([]);
  const [scorers, setScorers] = useState<Scorer[]>([]);
  const [scorersSource, setScorersSource] = useState<string>("");
  const [updated, setUpdated] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase.functions.invoke("standings", { body: { kind: "all" } });
      if (cancelled) return;
      if (error) { setErr(error.message); setLoading(false); return; }
      const d = data as { standings?: Group[]; scorers?: Scorer[]; scorers_source?: string; updated_at?: string };
      setGroups(d.standings ?? []);
      setScorers(d.scorers ?? []);
      setScorersSource(d.scorers_source ?? "");
      setUpdated(d.updated_at ?? "");
      setLoading(false);
    };
    load();
    const id = window.setInterval(load, 90_000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Helmet>
        <title>Standings & Stats · Pitch26 World Cup 2026</title>
        <meta name="description" content="Live FIFA World Cup 2026 group standings and top scorer stats, refreshed every minute." />
      </Helmet>

      <motion.h1
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="display text-4xl tracking-wider text-primary sm:text-5xl"
      >Standings &amp; Stats</motion.h1>

      <div className="mt-6 inline-flex rounded-full border border-border bg-card/60 p-1">
        {(["standings", "scorers"] as const).map((k) => (
          <button
            key={k} onClick={() => setTab(k)}
            className={`relative rounded-full px-5 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
              tab === k ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:text-foreground"
            }`}
          >{k === "standings" ? "Groups" : "Top scorers"}</button>
        ))}
      </div>

      {loading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : err ? (
        <p className="mt-8 text-sm text-destructive">{err}</p>
      ) : tab === "standings" ? (
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {groups.length === 0 && <p className="text-sm text-muted-foreground">No group data yet — draw has not been staged.</p>}
          {groups.map((g, index) => (
            <motion.div key={`${g.group ?? "group"}-${g.stage}-${index}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="overflow-hidden rounded-xl border border-border bg-card/40">
              <div className="flex items-center justify-between border-b border-border/60 bg-secondary/30 px-4 py-2">
                <h2 className="display text-xl tracking-wider text-primary">{groupTitle(g.group, g.stage)}</h2>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{stageTitle(g.stage)}</span>
              </div>
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                  <tr className="border-b border-border/60">
                    <th className="w-8 py-2 pl-3 text-left">#</th>
                    <th className="py-2 text-left">Team</th>
                    <th className="py-2 text-center">P</th>
                    <th className="py-2 text-center">W</th>
                    <th className="py-2 text-center">D</th>
                    <th className="py-2 text-center">L</th>
                    <th className="py-2 text-center">GD</th>
                    <th className="py-2 pr-3 text-center font-bold text-primary">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {g.table.map((r) => (
                    <tr key={r.team.name} className="border-b border-border/40 last:border-0 tabular-nums">
                      <td className="py-2 pl-3 text-muted-foreground">{r.position}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          {r.team.crest && <img src={r.team.crest} alt="" className="h-4 w-4" loading="lazy" />}
                          <span className="font-medium">{r.team.name}</span>
                        </div>
                      </td>
                      <td className="py-2 text-center">{r.played}</td>
                      <td className="py-2 text-center">{r.won}</td>
                      <td className="py-2 text-center">{r.draw}</td>
                      <td className="py-2 text-center">{r.lost}</td>
                      <td className={`py-2 text-center ${r.gd > 0 ? "text-emerald-400" : r.gd < 0 ? "text-red-400" : ""}`}>
                        {r.gd > 0 ? "+" : ""}{r.gd}
                      </td>
                      <td className="py-2 pr-3 text-center font-bold text-primary">{r.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          {scorersSource && !["WC", "WorldCupWiki", "Google"].includes(scorersSource) && (
            <p className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-muted-foreground">
              Showing top scorers from <span className="font-bold text-primary">
                {({ WCQ: "World Cup Qualifying", CL: "UEFA Champions League", EL: "UEFA Europa League", PL: "Premier League", PD: "LaLiga", SA: "Serie A", BL1: "Bundesliga", FL1: "Ligue 1", CLI: "Copa Libertadores" } as Record<string,string>)[scorersSource] ?? scorersSource}
              </span> instead.
            </p>
          )}
          <div className="overflow-hidden rounded-xl border border-border bg-card/40">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-border/60">
                  <th className="w-8 py-3 pl-4 text-left">#</th>
                  <th className="py-3 text-left">Player</th>
                  <th className="py-3 text-left">Team</th>
                  <th className="py-3 text-center">P</th>
                  <th className="py-3 text-center">Ast</th>
                  <th className="py-3 pr-4 text-center font-bold text-primary">Goals</th>
                </tr>
              </thead>
              <tbody>
                {scorers.length === 0 && (
                  <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No goals recorded yet.</td></tr>
                )}
                {scorers.map((s, i) => (
                  <tr key={s.player.name + i} className="border-b border-border/40 last:border-0 tabular-nums">
                    <td className="py-3 pl-4 text-muted-foreground">{i + 1}</td>
                    <td className="py-3 font-medium">{s.player.name}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        {s.team.crest && <img src={s.team.crest} alt="" className="h-4 w-4" loading="lazy" />}
                        <span>{s.team.name}</span>
                      </div>
                    </td>
                    <td className="py-3 text-center">{s.played ?? "—"}</td>
                    <td className="py-3 text-center">{s.assists ?? 0}</td>
                    <td className="py-3 pr-4 text-center text-lg font-bold text-primary">{s.goals}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
