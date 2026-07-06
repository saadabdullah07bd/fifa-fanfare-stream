// Full match detail including goal timeline for a given football-data.org match id.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const token = Deno.env.get("FOOTBALL_DATA_API_TOKEN");
  if (!token) {
    return new Response(JSON.stringify({ error: "token missing" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return new Response(JSON.stringify({ error: "id required" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const res = await fetch(`https://api.football-data.org/v4/matches/${id}`, {
    headers: { "X-Auth-Token": token },
  });
  if (!res.ok) {
    return new Response(JSON.stringify({ error: `fd ${res.status}`, detail: await res.text() }), {
      status: res.status, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const m: any = await res.json();

  const out: any = {
    id: m.id,
    competition: m.competition?.name,
    status: m.status,
    minute: m.minute ?? null,
    injury_time: m.injuryTime ?? null,
    utc_date: m.utcDate,
    venue: m.venue ?? null,
    referees: (m.referees ?? []).map((r: any) => r.name),
    home: { name: m.homeTeam?.name, tla: m.homeTeam?.tla, crest: m.homeTeam?.crest, id: m.homeTeam?.id },
    away: { name: m.awayTeam?.name, tla: m.awayTeam?.tla, crest: m.awayTeam?.crest, id: m.awayTeam?.id },
    score: {
      full: m.score?.fullTime ?? { home: null, away: null },
      half: m.score?.halfTime ?? { home: null, away: null },
      winner: m.score?.winner ?? null,
    },
    goals: (m.goals ?? []).map((g: any) => ({
      minute: g.minute,
      injury_time: g.injuryTime ?? null,
      type: g.type ?? "REGULAR",
      team_tla: g.team?.tla,
      team_name: g.team?.name,
      scorer: g.scorer?.name,
      assist: g.assist?.name ?? null,
      score: g.score ?? null,
    })),
    bookings: (m.bookings ?? []).map((b: any) => ({
      minute: b.minute,
      card: b.card,
      player: b.player?.name,
      team_tla: b.team?.tla,
    })),
    substitutions: (m.substitutions ?? []).length,
  };

  // Enrich with real-time data from API-Football (live minute, live score, HT flag)
  const afKey = Deno.env.get("API_FOOTBALL_KEY");
  if (afKey && ["IN_PLAY", "PAUSED", "LIVE", "SCHEDULED", "TIMED"].includes(out.status)) {
    try {
      const norm = (s: string) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const dayISO = out.utc_date?.slice(0, 10);
      const searchUrl = dayISO
        ? `https://v3.football.api-sports.io/fixtures?date=${dayISO}`
        : `https://v3.football.api-sports.io/fixtures?live=all`;
      const r = await fetch(searchUrl, { headers: { "x-apisports-key": afKey } });
      if (r.ok) {
        const j: any = await r.json();
        const fixtures: any[] = j?.response ?? [];
        const hn = norm(out.home.name);
        const an = norm(out.away.name);
        const f = fixtures.find((x) => {
          const h = norm(x.teams?.home?.name);
          const a = norm(x.teams?.away?.name);
          return (h.includes(hn.slice(0, 5)) || hn.includes(h.slice(0, 5))) &&
                 (a.includes(an.slice(0, 5)) || an.includes(a.slice(0, 5)));
        });
        if (f) {
          const shortStatus = f.fixture?.status?.short;
          const statusMap: Record<string, string> = {
            "1H": "IN_PLAY", "2H": "IN_PLAY", "ET": "IN_PLAY", "P": "IN_PLAY",
            "HT": "PAUSED", "BT": "PAUSED",
            "FT": "FINISHED", "AET": "FINISHED", "PEN": "FINISHED",
          };
          out.status = statusMap[shortStatus] ?? out.status;
          out.minute = f.fixture?.status?.elapsed ?? out.minute;
          out.injury_time = f.fixture?.status?.extra ?? out.injury_time;
          out.status_short = shortStatus;
          out.status_long = f.fixture?.status?.long;
          if (f.goals?.home != null) out.score.full.home = f.goals.home;
          if (f.goals?.away != null) out.score.full.away = f.goals.away;
          out.live_source = "api-football";
          out.af_fixture_id = f.fixture?.id;
        }
      }
    } catch (_) { /* optional */ }
  }

  return new Response(JSON.stringify(out), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
