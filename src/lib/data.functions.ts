import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export const getHomeSummary = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const now = new Date().toISOString();
  const [live, upcoming, scorers, news] = await Promise.all([
    sb.from("matches").select("*").eq("status", "live").order("date_utc"),
    sb
      .from("matches")
      .select("*")
      .gt("date_utc", now)
      .order("date_utc")
      .limit(6),
    sb.from("scorers").select("*").order("goals", { ascending: false }).limit(5),
    sb.from("news").select("*").order("published_at", { ascending: false }).limit(4),
  ]);
  return {
    live: live.data ?? [],
    upcoming: upcoming.data ?? [],
    scorers: scorers.data ?? [],
    news: news.data ?? [],
  };
});

export const getAllMatches = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await publicClient()
    .from("matches")
    .select("*")
    .order("date_utc");
  return data ?? [];
});

export const getGroups = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const [standings, teams] = await Promise.all([
    sb.from("standings").select("*").order("pts", { ascending: false }),
    sb.from("teams").select("*").order("name"),
  ]);
  return { standings: standings.data ?? [], teams: teams.data ?? [] };
});

export const getTeams = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await publicClient().from("teams").select("*").order("name");
  return data ?? [];
});

export const getVenues = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await publicClient().from("venues").select("*").order("country").order("city");
  return data ?? [];
});

export const getScorers = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await publicClient()
    .from("scorers")
    .select("*")
    .order("goals", { ascending: false })
    .limit(50);
  return data ?? [];
});

export const getNews = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await publicClient()
    .from("news")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(30);
  return data ?? [];
});

export const getLastRefresh = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await publicClient()
    .from("scrape_runs")
    .select("*")
    .order("last_run_at", { ascending: false });
  return data ?? [];
});
