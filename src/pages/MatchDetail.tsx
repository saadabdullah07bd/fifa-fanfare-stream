import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin } from "lucide-react";
import { Seo } from "@/lib/seo";
import { bdTime, bdDate, countryName, flagUrl } from "@/lib/flags";
import { getWc26Match } from "@/data/wc26-matches";

/**
 * Detailed view for a specific match. All data comes from the bundled FIFA
 * World Cup 2026 workbook (`src/data/wc26-matches.json`) — no live API or AI
 * enrichment.
 */
export default function MatchDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  };

  const m = getWc26Match(id);

  if (!m) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-24 text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Match not found</p>
        <button type="button" onClick={goBack} className="mt-4 text-xs uppercase tracking-[0.2em] text-primary hover:underline">← Back</button>
      </div>
    );
  }

  const homeName = countryName(m.home_code) || m.home_name;
  const awayName = countryName(m.away_code) || m.away_name;
  const kickoffLabel = m.date_utc
    ? `${bdDate(m.date_utc)} · ${bdTime(m.date_utc)}`
    : m.stage_label;
  const homeCrest = flagUrl(m.home_code, 160);
  const awayCrest = flagUrl(m.away_code, 160);

  const cards = [
    ...m.yellow_cards.map((c) => ({ ...c, card: "YELLOW" as const })),
    ...m.red_cards.map((c) => ({ ...c, card: "RED" as const })),
  ].sort((a, b) => a.minute - b.minute);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
      className="mx-auto max-w-4xl px-3 py-6 sm:px-4 sm:py-10"
    >
      <Seo
        title={`${homeName} vs ${awayName} — FIFA World Cup 2026 | Pitch26`}
        description={`${m.stage_label} · ${homeName} vs ${awayName}. Score, scorers, venue and kickoff time for the FIFA World Cup 2026 match on Pitch26.`}
        path={`/match/${m.match_no}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "SportsEvent",
          name: `${homeName} vs ${awayName}`,
          startDate: m.date_utc,
          sport: "Association football",
          competitor: [
            { "@type": "SportsTeam", name: homeName },
            { "@type": "SportsTeam", name: awayName },
          ],
        }}
      />
      <h1 className="sr-only">{homeName} vs {awayName} — {m.stage_label}</h1>
      <button type="button" onClick={goBack} className="text-xs uppercase tracking-[0.2em] text-primary hover:underline">← Back</button>

      <motion.div
        layout
        className="mt-4 relative overflow-hidden rounded-2xl border border-border bg-card/85 p-4 sm:p-6 shadow-2xl"
      >
        <div className="relative flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <span className="font-bold text-primary">{kickoffLabel}</span>
          <span>{m.stage_label}</span>
        </div>

        <div className="relative mt-6 grid grid-cols-3 items-center gap-2 sm:gap-4">
          <div className="flex flex-col items-end gap-2 text-right min-w-0">
            {homeCrest && <img src={homeCrest} alt={homeName} className="h-10 w-14 sm:h-12 sm:w-16 md:h-14 md:w-20 rounded object-cover ring-1 ring-border" />}
            <p className="display w-full truncate text-base sm:text-2xl md:text-3xl" title={homeName}>{homeName}</p>
          </div>
          <div className="text-center">
            <p className="display text-4xl sm:text-6xl md:text-7xl text-primary tabular-nums whitespace-nowrap">
              {m.home_score ?? "–"} : {m.away_score ?? "–"}
            </p>
            {m.penalty_shootout && (
              <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Pens {m.penalty_shootout}
              </p>
            )}
            {m.extra_time && !m.penalty_shootout && (
              <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                After extra time
              </p>
            )}
          </div>
          <div className="flex flex-col items-start gap-2 text-left min-w-0">
            {awayCrest && <img src={awayCrest} alt={awayName} className="h-10 w-14 sm:h-12 sm:w-16 md:h-14 md:w-20 rounded object-cover ring-1 ring-border" />}
            <p className="display w-full truncate text-base sm:text-2xl md:text-3xl" title={awayName}>{awayName}</p>
          </div>
        </div>

        {m.venue_name && (
          <p className="relative mt-4 inline-flex w-full items-center justify-center gap-1.5 text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <MapPin className="h-3 w-3" aria-hidden="true" />
            {m.venue_name}{m.venue_city ? ` · ${m.venue_city}` : ""}{m.venue_country ? ` · ${m.venue_country}` : ""}
          </p>
        )}
      </motion.div>

      {/* Goals */}
      <section className="mt-10">
        <h2 className="display text-2xl text-primary">Goals</h2>
        {m.goals.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {m.home_score == null ? "Match not yet played." : "No goals recorded."}
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <GoalColumn title={homeName} code={m.home_code} goals={homeGoals} align="left" />
            <GoalColumn title={awayName} code={m.away_code} goals={awayGoals} align="right" />
          </div>
        )}
      </section>

      {m.notes && (
        <section className="mt-8 rounded-lg border border-border bg-card/40 p-4 text-sm text-muted-foreground">
          <p className="text-[10px] uppercase tracking-[0.2em] text-primary">Notes</p>
          <p className="mt-1">{m.notes}</p>
        </section>
      )}
    </motion.div>
  );
}

function GoalColumn({
  title, code, goals, align,
}: {
  title: string;
  code: string | null;
  goals: { player: string; minute: number; injury: number | null; type: string }[];
  align: "left" | "right";
}) {
  const url = flagUrl(code, 40);
  return (
    <div className={`rounded-lg border border-border bg-card/50 p-4 ${align === "right" ? "sm:text-right" : ""}`}>
      <div className={`flex items-center gap-2 ${align === "right" ? "sm:justify-end" : ""}`}>
        {url && <img src={url} alt={code ?? ""} className="h-4 w-6 rounded-[2px] object-cover ring-1 ring-border" />}
        <p className="display text-sm">{title}</p>
      </div>
      {goals.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">—</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1.5 text-sm">
          {goals.map((g, i) => (
            <li key={i} className={`flex items-center gap-2 ${align === "right" ? "sm:justify-end" : ""}`}>
              <span aria-hidden>⚽</span>
              <span className="truncate">
                {g.player}
                {g.type === "OG" && <span className="ml-1 text-[10px] uppercase tracking-widest text-muted-foreground">(OG)</span>}
                {g.type === "PEN" && <span className="ml-1 text-[10px] uppercase tracking-widest text-muted-foreground">(Pen)</span>}
              </span>
              <span className="display shrink-0 text-primary tabular-nums">
                {g.minute}{g.injury ? `+${g.injury}` : ""}'
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
