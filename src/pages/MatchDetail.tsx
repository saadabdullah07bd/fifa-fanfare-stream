import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, ArrowLeft, Users, Flag, Share2, CircleDot, Trophy } from "lucide-react";
import { Seo } from "@/lib/seo";
import { bdTime, bdDate, countryName, flagUrl } from "@/lib/flags";
import { getWc26Match } from "@/data/wc26-matches";
import { toast } from "sonner";
import { springSoft, useCountUp } from "@/lib/motion";
import MatchStatsPanel from "@/components/MatchStatsPanel";

/** Animated score digit — counts up from 0 on mount, snaps if reduced-motion. */
function ScoreValue({ value }: { value: number }) {
  const shown = useCountUp(value, 800);
  return <>{shown}</>;
}

type EventKind = "GOAL" | "YELLOW" | "RED";
type TimelineEvent = {
  kind: EventKind;
  minute: number;
  injury?: number | null;
  player: string;
  side: "home" | "away";
  type?: string; // for goals: OG / PEN / normal
};

/**
 * Detailed view for a specific match — Premium Broadcast layout.
 * All data comes from the bundled FIFA World Cup 2026 workbook.
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
        <button
          type="button"
          onClick={goBack}
          className="mt-4 inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-primary hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back
        </button>
      </div>
    );
  }

  const homeName = countryName(m.home_code) || m.home_name;
  const awayName = countryName(m.away_code) || m.away_name;
  const kickoffDate = m.date_utc ? bdDate(m.date_utc) : m.stage_label;
  const kickoffTime = m.date_utc ? bdTime(m.date_utc) : "";
  const homeCrest = flagUrl(m.home_code, 160);
  const awayCrest = flagUrl(m.away_code, 160);

  // Match status derivation from scores/date.
  const decided = m.home_score != null && m.away_score != null;
  const hs = m.home_score ?? 0;
  const as = m.away_score ?? 0;
  const homeWin = decided && hs > as;
  const awayWin = decided && as > hs;
  const isLive = !decided && m.date_utc ? isWithin(m.date_utc, 2 * 60 * 60 * 1000) : false;
  const isUpcoming = !decided && !isLive;
  const statusLabel = decided ? "Full time" : isLive ? "Live" : "Kickoff";

  // Split goals by scoring team (OG credits opposite side).
  const goalSide = (g: { team?: string; type: string }): "home" | "away" => {
    const scorerTeam = g.team ?? m.home_name;
    const creditedTeam =
      g.type === "OG" ? (scorerTeam === m.home_name ? m.away_name : m.home_name) : scorerTeam;
    return creditedTeam === m.home_name ? "home" : "away";
  };
  const homeGoals = m.goals
    .filter((g) => goalSide(g) === "home")
    .sort((a, b) => a.minute - b.minute);
  const awayGoals = m.goals
    .filter((g) => goalSide(g) === "away")
    .sort((a, b) => a.minute - b.minute);

  const allCards = [
    ...m.yellow_cards.map((c) => ({ ...c, card: "YELLOW" as const })),
    ...m.red_cards.map((c) => ({ ...c, card: "RED" as const })),
  ].sort((a, b) => a.minute - b.minute);
  const homeCards = allCards.filter((c) => c.team === m.home_name);
  const awayCards = allCards.filter((c) => c.team === m.away_name);

  // Unified chronological timeline.
  const timeline: TimelineEvent[] = [
    ...m.goals.map((g) => ({
      kind: "GOAL" as const,
      minute: g.minute,
      injury: g.injury,
      player: g.player,
      side: goalSide(g),
      type: g.type,
    })),
    ...allCards.map((c) => ({
      kind: c.card,
      minute: c.minute,
      injury: c.injury,
      player: c.player,
      side: (c.team === m.home_name ? "home" : "away") as "home" | "away",
    })),
  ].sort((a, b) => a.minute - b.minute || (a.injury ?? 0) - (b.injury ?? 0));

  const share = async () => {
    const url = window.location.href;
    const text = `${homeName} ${decided ? hs : ""} ${decided ? "vs" : "vs"} ${decided ? as + " " : ""}${awayName} — ${m.stage_label}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: text, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 pb-16 sm:py-8">
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
      <h1 className="sr-only">
        {homeName} vs {awayName} — {m.stage_label}
      </h1>

      {/* Top action bar */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border bg-card/50 px-3 py-1.5 text-xs uppercase tracking-[0.2em] text-muted-foreground transition hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back
        </button>
        <button
          type="button"
          onClick={share}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border bg-card/50 px-3 py-1.5 text-xs uppercase tracking-[0.2em] text-muted-foreground transition hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Share match"
        >
          <Share2 className="h-3.5 w-3.5" aria-hidden="true" /> Share
        </button>
      </div>

      {/* Hero scoreboard */}
      <motion.section
        layout
        aria-label="Scoreboard"
        className="relative mt-4 overflow-hidden rounded-3xl border border-border bg-card/80 p-5 shadow-2xl sm:p-8"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(60% 80% at 100% 0%, rgba(var(--primary-rgb), 0.18), transparent 60%), radial-gradient(50% 70% at 0% 100%, rgba(var(--trophy-green-rgb), 0.22), transparent 60%)",
          }}
        />

        <div className="relative flex items-center justify-between text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <StatusBadge
              decided={decided}
              live={isLive}
              upcoming={isUpcoming}
              label={statusLabel}
            />
            <span className="text-primary">{m.stage_label}</span>
          </span>
          <span className="hidden text-right sm:inline">
            {kickoffDate}
            {kickoffTime && ` · ${kickoffTime}`}
          </span>
        </div>

        <div className="relative mt-6 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-6">
          <TeamBlock
            side="left"
            code={m.home_code}
            name={homeName}
            crest={homeCrest}
            winner={homeWin}
            loser={awayWin}
          />

          <div className="text-center">
            {decided ? (
              <motion.p
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={springSoft}
                className="display text-4xl leading-none text-primary tabular-nums whitespace-nowrap sm:text-6xl md:text-7xl"
                aria-label={`Final score ${hs} to ${as}`}
              >
                <span className={homeWin ? "" : awayWin ? "opacity-70" : ""}>
                  <ScoreValue value={hs} />
                </span>
                <span className="mx-2 text-muted-foreground/60">:</span>
                <span className={awayWin ? "" : homeWin ? "opacity-70" : ""}>
                  <ScoreValue value={as} />
                </span>
              </motion.p>
            ) : (
              <div className="flex flex-col items-center">
                <p className="display text-xl leading-none tabular-nums text-primary sm:text-3xl md:text-4xl">
                  {kickoffTime || "TBD"}
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                  {kickoffDate}
                </p>
              </div>
            )}
            {m.penalty_shootout && (
              <p className="mt-2 text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                Pens {m.penalty_shootout}
              </p>
            )}
            {m.extra_time && !m.penalty_shootout && (
              <p className="mt-2 text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                After extra time
              </p>
            )}
          </div>

          <TeamBlock
            side="right"
            code={m.away_code}
            name={awayName}
            crest={awayCrest}
            winner={awayWin}
            loser={homeWin}
          />
        </div>

        {(m.venue_name || m.venue_city) && (
          <p className="relative mt-6 flex flex-wrap items-center justify-center gap-1.5 text-center text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            {m.venue_name}
            {m.venue_city && <span className="opacity-70">· {m.venue_city}</span>}
            {m.venue_country && <span className="opacity-70">· {m.venue_country}</span>}
          </p>
        )}

        {/* Mobile kickoff row */}
        <p className="relative mt-2 text-center text-[10px] uppercase tracking-[0.24em] text-muted-foreground sm:hidden">
          {kickoffDate}
          {kickoffTime && ` · ${kickoffTime}`}
        </p>
      </motion.section>

      {/* Google-style split summary (still helpful at a glance) */}
      {m.goals.length > 0 && (
        <section
          aria-label="Goalscorers"
          className="mt-8 rounded-3xl border border-border bg-card/40 p-4 sm:p-6"
        >
          <h2 className="mb-4 text-center text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Goalscorers
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-6">
            <ul className="flex flex-col gap-2 border-r border-border/60 pr-2 sm:pr-4">
              {homeGoals.length === 0 ? (
                <li className="text-right text-xs text-muted-foreground/60">—</li>
              ) : (
                homeGoals.map((g, i) => (
                  <li key={`h${i}`} className="flex items-start justify-end gap-2 text-right">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{g.player}</p>
                      {(g.type === "OG" || g.type === "PEN") && (
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          {g.type === "OG" ? "Own goal" : "Penalty"}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 tabular-nums text-sm text-muted-foreground">
                      {g.minute}
                      {g.injury ? `+${g.injury}` : ""}'
                    </span>
                    <span aria-hidden="true" className="shrink-0 text-sm">
                      ⚽
                    </span>
                  </li>
                ))
              )}
            </ul>
            <ul className="flex flex-col gap-2 pl-2 sm:pl-4">
              {awayGoals.length === 0 ? (
                <li className="text-xs text-muted-foreground/60">—</li>
              ) : (
                awayGoals.map((g, i) => (
                  <li key={`a${i}`} className="flex items-start justify-start gap-2 text-left">
                    <span aria-hidden="true" className="shrink-0 text-sm">
                      ⚽
                    </span>
                    <span className="shrink-0 tabular-nums text-sm text-muted-foreground">
                      {g.minute}
                      {g.injury ? `+${g.injury}` : ""}'
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
                ))
              )}
            </ul>
          </div>
        </section>
      )}

      {/* Chronological timeline */}
      {timeline.length > 0 && (
        <section aria-label="Match timeline" className="mt-8">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="display text-xl sm:text-2xl">Timeline</h2>
            <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              {timeline.length} event{timeline.length === 1 ? "" : "s"}
            </span>
          </div>

          <ol className="relative space-y-2">
            {/* center rail */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-border/60"
            />
            {timeline.map((ev, i) => (
              <TimelineRow key={i} ev={ev} />
            ))}
          </ol>
        </section>
      )}

      {/* Match stats (from real scoreline/events) + lineups composed from each
          nation's real squad with player headshots. Available for every match. */}
      <MatchStatsPanel match={m} />

      {/* Cards summary (also under timeline for scanability) */}
      {allCards.length > 0 && (
        <section
          aria-label="Bookings"
          className="mt-8 rounded-3xl border border-border bg-card/40 p-4 sm:p-6"
        >
          <h2 className="mb-4 text-center text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Bookings
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-6">
            <ul className="flex flex-col gap-2 border-r border-border/60 pr-2 sm:pr-4">
              {homeCards.length === 0 ? (
                <li className="text-right text-xs text-muted-foreground/60">—</li>
              ) : (
                homeCards.map((c, i) => (
                  <li key={`hc${i}`} className="flex items-center justify-end gap-2 text-right">
                    <p className="truncate text-sm">{c.player}</p>
                    <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                      {c.minute}
                      {c.injury ? `+${c.injury}` : ""}'
                    </span>
                    <CardChip color={c.card} />
                  </li>
                ))
              )}
            </ul>
            <ul className="flex flex-col gap-2 pl-2 sm:pl-4">
              {awayCards.length === 0 ? (
                <li className="text-xs text-muted-foreground/60">—</li>
              ) : (
                awayCards.map((c, i) => (
                  <li key={`ac${i}`} className="flex items-center justify-start gap-2 text-left">
                    <CardChip color={c.card} />
                    <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                      {c.minute}
                      {c.injury ? `+${c.injury}` : ""}'
                    </span>
                    <p className="truncate text-sm">{c.player}</p>
                  </li>
                ))
              )}
            </ul>
          </div>
        </section>
      )}

      {m.goals.length === 0 && timeline.length === 0 && (
        <div className="mt-8 rounded-3xl border border-border bg-card/40 p-10 text-center">
          <CircleDot className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm text-muted-foreground">
            {m.home_score == null ? "Match not yet played." : "No goals or bookings recorded."}
          </p>
          <Link
            to="/fixtures"
            className="mt-4 inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-primary hover:underline"
          >
            View all fixtures →
          </Link>
        </div>
      )}

      {/* Match info */}
      {(m.referee || m.attendance) && (
        <section aria-label="Match info" className="mt-8 grid gap-3 sm:grid-cols-2">
          {m.referee && (
            <InfoCard
              icon={<Flag className="h-4 w-4" aria-hidden="true" />}
              label="Referee"
              value={m.referee}
            />
          )}
          {m.attendance && (
            <InfoCard
              icon={<Users className="h-4 w-4" aria-hidden="true" />}
              label="Attendance"
              value={m.attendance.toLocaleString()}
            />
          )}
        </section>
      )}
    </div>
  );
}

/* ---------- Small building blocks ---------- */

function TeamBlock({
  side,
  code,
  name,
  crest,
  winner,
  loser,
}: {
  side: "left" | "right";
  code: string | null;
  name: string;
  crest: string | null;
  winner: boolean;
  loser: boolean;
}) {
  const isLeft = side === "left";
  return (
    <div
      className={`flex flex-col gap-2 min-w-0 ${isLeft ? "items-end text-right" : "items-start text-left"} ${loser ? "opacity-70" : ""}`}
    >
      <div className="relative">
        {crest ? (
          <img
            src={crest}
            alt=""
            className={`h-12 w-16 rounded object-cover ring-1 sm:h-14 sm:w-20 md:h-16 md:w-24 ${winner ? "ring-primary shadow-[0_0_0_4px_rgba(var(--primary-rgb),0.15)]" : "ring-border"}`}
          />
        ) : (
          <div
            className="h-12 w-16 rounded bg-secondary/40 ring-1 ring-border sm:h-14 sm:w-20 md:h-16 md:w-24"
            aria-hidden="true"
          />
        )}
        {winner && (
          <span
            aria-label="Winner"
            className={`absolute -top-2 grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground shadow ${isLeft ? "-right-2" : "-left-2"}`}
          >
            <Trophy className="h-3 w-3" aria-hidden="true" />
          </span>
        )}
      </div>
      <Link
        to={`/team/${encodeURIComponent(name)}`}
        className={`display block w-full truncate rounded-sm text-base leading-tight transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:text-2xl md:text-3xl ${winner ? "text-primary" : ""}`}
        title={`${name} — squad, tactics & history`}
      >
        {name}
      </Link>
      {code && (
        <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">{code}</p>
      )}
    </div>
  );
}

function StatusBadge({
  decided,
  live,
  upcoming,
  label,
}: {
  decided: boolean;
  live: boolean;
  upcoming: boolean;
  label: string;
}) {
  if (live) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-destructive">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive/70" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-destructive" />
        </span>
        {label}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em] ${
        decided
          ? "bg-primary/15 text-primary"
          : upcoming
            ? "bg-secondary/60 text-foreground"
            : "bg-secondary/40 text-muted-foreground"
      }`}
    >
      {label}
    </span>
  );
}

function TimelineRow({ ev }: { ev: TimelineEvent }) {
  const isHome = ev.side === "home";
  const minute = `${ev.minute}${ev.injury ? `+${ev.injury}` : ""}'`;
  const icon =
    ev.kind === "GOAL" ? (
      <span aria-hidden="true" className="text-base">
        ⚽
      </span>
    ) : (
      <CardChip color={ev.kind} />
    );
  const subline =
    ev.kind === "GOAL" && (ev.type === "OG" || ev.type === "PEN")
      ? ev.type === "OG"
        ? "Own goal"
        : "Penalty"
      : ev.kind === "YELLOW"
        ? "Yellow card"
        : ev.kind === "RED"
          ? "Red card"
          : null;

  return (
    <li className="relative grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3">
      {/* Home side */}
      <div className={`min-w-0 justify-self-end text-right ${isHome ? "" : "opacity-0"}`}>
        {isHome && (
          <div className="ml-auto flex max-w-full items-start gap-2 rounded-2xl border border-border/60 bg-card/60 px-2.5 py-2 sm:px-3">
            <div className="min-w-0 text-right">
              <p className="truncate text-sm font-semibold">{ev.player}</p>
              {subline && (
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {subline}
                </p>
              )}
            </div>
            <span className="shrink-0">{icon}</span>
          </div>
        )}
      </div>

      {/* Minute pill */}
      <span className="relative z-10 inline-flex h-8 min-w-[3rem] items-center justify-center rounded-full border border-border bg-background text-[11px] font-bold tabular-nums text-primary shadow-sm">
        {minute}
      </span>

      {/* Away side */}
      <div className={`min-w-0 justify-self-start text-left ${isHome ? "opacity-0" : ""}`}>
        {!isHome && (
          <div className="mr-auto flex max-w-full items-start gap-2 rounded-2xl border border-border/60 bg-card/60 px-2.5 py-2 sm:px-3">
            <span className="shrink-0">{icon}</span>
            <div className="min-w-0 text-left">
              <p className="truncate text-sm font-semibold">{ev.player}</p>
              {subline && (
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {subline}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

function CardChip({ color }: { color: "YELLOW" | "RED" }) {
  return (
    <span
      aria-label={color === "RED" ? "Red card" : "Yellow card"}
      className={`inline-block h-4 w-3 shrink-0 rounded-[2px] shadow-sm ${
        color === "RED" ? "bg-red-500" : "bg-yellow-400"
      }`}
    />
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/50 p-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.22em] text-primary">{label}</p>
        <p className="mt-0.5 truncate text-sm">{value}</p>
      </div>
    </div>
  );
}

function isWithin(dateUtc: string, windowMs: number) {
  const t = new Date(dateUtc).getTime();
  if (Number.isNaN(t)) return false;
  const now = Date.now();
  return now >= t && now <= t + windowMs;
}
