import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Trophy, Users, Shirt, History, ChevronLeft } from "lucide-react";
import { Seo } from "@/lib/seo";
import { supabase } from "@/integrations/supabase/client";
import { flagUrl } from "@/lib/flags";
import { WC26_MATCHES } from "@/data/wc26-matches";
import historyData from "@/data/wc-history.json";
import { staggerParent, staggerChild, springSoft, useReducedMotionSafe } from "@/lib/motion";

type WcRecord = {
  appearances: number;
  titles: number;
  titleYears?: string;
  best: string;
  bestYears?: string;
  note?: string;
};

type SquadPlayer = {
  id: number;
  name: string;
  age: number | null;
  number: number | null;
  position: string | null;
  photo: string | null;
};

type NationalOverview = {
  available: boolean;
  team: { id: number; name: string; code: string | null; logo: string | null } | null;
  squad: SquadPlayer[];
  formation: string | null;
  coach: string | null;
};

const POSITION_ORDER = ["Goalkeeper", "Defender", "Midfielder", "Attacker"] as const;

/** Player card with headshot and graceful initials fallback. */
function PlayerCard({ p }: { p: SquadPlayer }) {
  const initials = p.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <motion.div
      variants={staggerChild}
      className="flex min-w-0 items-center gap-3 rounded-2xl border border-border/60 bg-card/60 p-3"
    >
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-secondary ring-1 ring-border">
        {p.photo ? (
          <img
            src={p.photo}
            alt={p.name}
            loading="lazy"
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : null}
        <span className="absolute inset-0 -z-10 grid place-items-center text-xs font-bold text-muted-foreground">
          {initials}
        </span>
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{p.name}</p>
        <p className="text-xs text-muted-foreground">
          {p.number != null ? `#${p.number} · ` : ""}
          {p.position ?? ""}
          {p.age != null ? ` · ${p.age}y` : ""}
        </p>
      </div>
    </motion.div>
  );
}

/** Small stat tile for the WC record strip. */
function RecordTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-4 text-center">
      <p className="display text-3xl leading-none text-primary">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      {sub && <p className="mt-1 truncate text-[11px] text-muted-foreground/80">{sub}</p>}
    </div>
  );
}

export default function TeamDetail() {
  const { name } = useParams();
  const decoded = decodeURIComponent(name ?? "");
  const reduced = useReducedMotionSafe();

  // Resolve the FIFA code + this team's 2026 matches from the bundled data.
  const teamMatches = WC26_MATCHES.filter(
    (m) => m.home_name === decoded || m.away_name === decoded,
  );
  const code =
    teamMatches.find((m) => m.home_name === decoded)?.home_code ??
    teamMatches.find((m) => m.away_name === decoded)?.away_code ??
    null;
  const record: WcRecord | undefined =
    code && code !== "_note"
      ? (historyData as unknown as Record<string, WcRecord>)[code]
      : undefined;
  const flag = flagUrl(code, 160);

  // Squad + tactics via the club edge function (API-Football, cached server-side).
  const { data: nat, isLoading: natLoading } = useQuery<NationalOverview>({
    queryKey: ["national", decoded],
    enabled: decoded.length >= 3,
    staleTime: 60 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("club", {
        body: { action: "national", name: decoded },
      });
      if (error) throw error;
      return data as NationalOverview;
    },
  });

  // Wikipedia summary for the About section.
  const { data: wiki } = useQuery({
    queryKey: ["wiki-team", decoded],
    enabled: !!decoded,
    staleTime: 24 * 3600_000,
    queryFn: async () => {
      const tryFetch = async (title: string) => {
        const res = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
        );
        if (!res.ok) throw new Error("wiki miss");
        return res.json() as Promise<{
          extract: string;
          description?: string;
          content_urls?: { desktop: { page: string } };
        }>;
      };
      try {
        return await tryFetch(`${decoded} national football team`);
      } catch {
        return await tryFetch(decoded);
      }
    },
  });

  const squadByPos = new Map<string, SquadPlayer[]>();
  for (const p of nat?.squad ?? []) {
    const k = p.position ?? "Other";
    if (!squadByPos.has(k)) squadByPos.set(k, []);
    squadByPos.get(k)!.push(p);
  }

  const played = teamMatches.filter((m) => m.home_score != null && m.away_score != null);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 pb-16 sm:py-8">
      <Seo
        title={`${decoded} — squad, tactics & World Cup history | Pitch26`}
        description={`${decoded} at the 2026 FIFA World Cup — full squad with player photos, tactics, results and World Cup history on Pitch26.`}
        path={`/team/${encodeURIComponent(decoded)}`}
      />

      <Link
        to="/fixtures"
        className="inline-flex items-center gap-1 text-xs uppercase tracking-wider text-primary"
      >
        <ChevronLeft size={14} aria-hidden="true" /> Fixtures
      </Link>

      {/* Hero */}
      <motion.header
        initial={reduced ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springSoft}
        className="mt-3 flex items-center gap-4"
      >
        {flag && (
          <img
            src={flag}
            alt=""
            aria-hidden="true"
            className="h-12 w-[4.5rem] rounded-md object-cover ring-1 ring-border sm:h-16 sm:w-24"
          />
        )}
        <div className="min-w-0">
          <h1 className="display text-4xl leading-none sm:text-6xl">{decoded}</h1>
          {wiki?.description && (
            <p className="mt-1 truncate text-sm text-muted-foreground">{wiki.description}</p>
          )}
        </div>
      </motion.header>

      {/* World Cup record */}
      {record && (
        <section className="mt-8" aria-labelledby="wc-record">
          <h2 id="wc-record" className="flex items-center gap-2 display text-2xl text-primary">
            <History size={20} aria-hidden="true" /> World Cup history
          </h2>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <RecordTile
              label="Appearances"
              value={record.appearances === 0 ? "1st" : String(record.appearances)}
              sub={record.appearances === 0 ? "Debut in 2026" : "before 2026"}
            />
            <RecordTile label="Titles" value={String(record.titles)} sub={record.titleYears} />
            <RecordTile label="Best finish" value={record.best} sub={record.bestYears} />
          </div>
          {record.note && <p className="mt-2 text-sm text-muted-foreground">{record.note}</p>}
        </section>
      )}

      {/* Tactics */}
      <section className="mt-8" aria-labelledby="tactics">
        <h2 id="tactics" className="flex items-center gap-2 display text-2xl text-primary">
          <Shirt size={20} aria-hidden="true" /> Tactics
        </h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <div className="rounded-2xl border border-border/60 bg-card/60 px-5 py-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Formation
            </p>
            <p className="display mt-1 text-3xl text-foreground">
              {natLoading ? "…" : (nat?.formation ?? "—")}
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/60 px-5 py-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Head coach
            </p>
            <p className="mt-1 text-lg font-semibold">{natLoading ? "…" : (nat?.coach ?? "—")}</p>
          </div>
        </div>
        {!natLoading && !nat?.available && (
          <p className="mt-2 text-sm text-muted-foreground">
            Live squad data is temporarily unavailable.
          </p>
        )}
      </section>

      {/* Squad */}
      <section className="mt-8" aria-labelledby="squad">
        <h2 id="squad" className="flex items-center gap-2 display text-2xl text-primary">
          <Users size={20} aria-hidden="true" /> Squad
        </h2>
        {natLoading && (
          <p className="mt-3 text-sm text-muted-foreground">Loading squad & player photos…</p>
        )}
        {POSITION_ORDER.map((pos) => {
          const players = squadByPos.get(pos);
          if (!players?.length) return null;
          return (
            <div key={pos} className="mt-5">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                {pos}s
              </h3>
              <motion.div
                variants={staggerParent}
                initial={reduced ? false : "initial"}
                animate="animate"
                className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"
              >
                {players.map((p) => (
                  <PlayerCard key={p.id} p={p} />
                ))}
              </motion.div>
            </div>
          );
        })}
      </section>

      {/* 2026 campaign */}
      {played.length > 0 && (
        <section className="mt-8" aria-labelledby="campaign">
          <h2 id="campaign" className="flex items-center gap-2 display text-2xl text-primary">
            <Trophy size={20} aria-hidden="true" /> 2026 campaign
          </h2>
          <ul className="mt-3 space-y-2">
            {teamMatches.map((m) => {
              const playedMatch = m.home_score != null && m.away_score != null;
              return (
                <li key={m.match_no}>
                  <Link
                    to={`/match/${m.match_no}`}
                    className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-2 rounded-2xl border border-border/60 bg-card/60 px-3 py-2.5 transition hover:border-primary/50"
                  >
                    <span
                      className={`truncate text-right text-sm ${m.home_name === decoded ? "font-bold" : ""}`}
                    >
                      {m.home_name}
                    </span>
                    <span className="display px-2 text-lg tabular-nums text-primary">
                      {playedMatch ? `${m.home_score}–${m.away_score}` : "vs"}
                    </span>
                    <span
                      className={`truncate text-sm ${m.away_name === decoded ? "font-bold" : ""}`}
                    >
                      {m.away_name}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {m.stage_label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* About */}
      {wiki?.extract && (
        <section className="mt-8 rounded-2xl border border-border/60 bg-card/40 p-6">
          <h2 className="display text-2xl text-primary">About</h2>
          <p className="mt-3 whitespace-pre-line text-foreground/90">{wiki.extract}</p>
          {wiki.content_urls?.desktop.page && (
            <a
              href={wiki.content_urls.desktop.page}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block text-xs uppercase tracking-wider text-primary"
            >
              Read on Wikipedia →
            </a>
          )}
        </section>
      )}
    </div>
  );
}
