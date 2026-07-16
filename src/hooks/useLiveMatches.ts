import { useQuery } from "@tanstack/react-query";

/**
 * Represents a match currently in progress or recently finished.
 */
export type LiveMatch = {
  id: number;
  competition: string;
  competition_code: string;
  status: string;
  minute: number | null;
  injury_time: number | null;
  utc_date: string;
  home: { name: string; tla: string; crest: string };
  away: { name: string; tla: string; crest: string };
  score: {
    full: { home: number | null; away: number | null };
    half: { home: number | null; away: number | null };
  };
};

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/live-matches`;

/**
 * Custom hook to fetch and poll live match data from Supabase Edge Function.
 *
 * @returns React Query object containing the matches data.
 */
export function useLiveMatches() {
  return useQuery({
    queryKey: ["live-matches"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const res = await fetch(FN_URL, {
        headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      });
      if (!res.ok) throw new Error(`Live matches request failed (${res.status})`);
      return res.json() as Promise<{ matches: LiveMatch[] }>;
    },
  });
}
