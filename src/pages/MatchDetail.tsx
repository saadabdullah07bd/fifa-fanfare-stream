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

  // Split goals by scoring team (OG credits to opposite of player's team, already resolved in JSON).
  const goalSide = (g: { team?: string; type: string }) => {
    const scorerTeam = g.team ?? m.home_name;
    const creditedTeam = g.type === "OG"
      ? (scorerTeam === m.home_name ? m.away_name : m.home_name)
      : scorerTeam;
    return creditedTeam === m.home_name ? "home" : "away";
  };
  const homeGoals = m.goals.filter((g) => goalSide(g) === "home").sort((a, b) => a.minute - b.minute);
  const awayGoals = m.goals.filter((g) => goalSide(g) === "away").sort((a, b) => a.minute - b.minute);

  const allCards = [
    ...m.yellow_cards.map((c) => ({ ...c, card: "YELLOW" as const })),
    ...m.red_cards.map((c) => ({ ...c, card: "RED" as const })),
  ].sort((a, b) => a.minute - b.minute);
  const homeCards = allCards.filter((c) => c.team === m.home_name);
  const awayCards = allCards.filter((c) => c.team === m.away_name);

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

      {/* Goals — Google-style split by team */}
      {m.goals.length > 0 ? (
        <section className="mt-8">
          <div className="grid grid-cols-2 gap-3 sm:gap-6">
            {/* Home goals column */}
            <ul className="flex flex-col gap-2 pr-2 sm:pr-4 border-r border-border">
              {homeGoals.length === 0 ? (
                <li className="text-xs text-muted-foreground/60">—</li>
              ) : homeGoals.map((g, i) => (
                <li key={`h${i}`} className="flex items-start justify-end gap-2 text-right">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{g.player}</p>
                    {(g.type === "OG" || g.type === "PEN") && (
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {g.type === "OG" ? "Own goal" : "Penalty"}
                      </p>
                    )}
                  </div>
                  <span className="tabular-nums text-sm text-muted-foreground shrink-0">
                    {g.minute}{g.injury ? `+${g.injury}` : ""}'
                  </span>
                  <span aria-hidden className="text-sm shrink-0">⚽</span>
                </li>
              ))}
            </ul>
            {/* Away goals column */}
            <ul className="flex flex-col gap-2 pl-2 sm:pl-4">
              {awayGoals.length === 0 ? (
                <li className="text-xs text-muted-foreground/60">—</li>
              ) : awayGoals.map((g, i) => (
                <li key={`a${i}`} className="flex items-start justify-start gap-2 text-left">
                  <span aria-hidden className="text-sm shrink-0">⚽</span>
                  <span className="tabular-nums text-sm text-muted-foreground shrink-0">
                    {g.minute}{g.injury ? `+${g.injury}` : ""}'
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{g.player}</p>
                    {(g.type === "OG" || g.type === "PEN") && (
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {g.type === "OG" ? "Own goal" : "Penalty"}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {m.home_score == null ? "Match not yet played." : "No goals recorded."}
        </p>
      )}

      {/* Cards — split by team */}
      {allCards.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-center text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Bookings</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-6">
            <ul className="flex flex-col gap-2 pr-2 sm:pr-4 border-r border-border">
              {homeCards.length === 0 ? (
                <li className="text-xs text-muted-foreground/60 text-right">—</li>
              ) : homeCards.map((c, i) => (
                <li key={`hc${i}`} className="flex items-center justify-end gap-2 text-right">
                  <p className="truncate text-sm">{c.player}</p>
                  <span className="tabular-nums text-xs text-muted-foreground shrink-0">
                    {c.minute}{c.injury ? `+${c.injury}` : ""}'
                  </span>
                  <span aria-hidden className={`inline-block h-4 w-3 shrink-0 rounded-[2px] ${c.card === "RED" ? "bg-red-500" : "bg-yellow-400"}`} />
                </li>
              ))}
            </ul>
            <ul className="flex flex-col gap-2 pl-2 sm:pl-4">
              {awayCards.length === 0 ? (
                <li className="text-xs text-muted-foreground/60">—</li>
              ) : awayCards.map((c, i) => (
                <li key={`ac${i}`} className="flex items-center justify-start gap-2 text-left">
                  <span aria-hidden className={`inline-block h-4 w-3 shrink-0 rounded-[2px] ${c.card === "RED" ? "bg-red-500" : "bg-yellow-400"}`} />
                  <span className="tabular-nums text-xs text-muted-foreground shrink-0">
                    {c.minute}{c.injury ? `+${c.injury}` : ""}'
                  </span>
                  <p className="truncate text-sm">{c.player}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Match info */}
      {(m.referee || m.attendance) && (
        <section className="mt-10 grid gap-3 sm:grid-cols-2">
          {m.referee && (
            <div className="rounded-lg border border-border bg-card/40 p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-primary">Referee</p>
              <p className="mt-1 text-sm">{m.referee}</p>
            </div>
          )}
          {m.attendance && (
            <div className="rounded-lg border border-border bg-card/40 p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-primary">Attendance</p>
              <p className="mt-1 text-sm tabular-nums">{m.attendance.toLocaleString()}</p>
            </div>
          )}
        </section>
      )}
    </motion.div>
  );
}

