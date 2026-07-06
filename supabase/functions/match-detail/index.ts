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

  const out = {
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

  return new Response(JSON.stringify(out), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
