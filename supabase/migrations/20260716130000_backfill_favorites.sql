-- Backfill favorites from legacy onboarding data (profiles.favorite_club_name).
-- Push notifications target favorites.team_code; users who onboarded before
-- the favorites upsert fix would otherwise receive no alerts.

INSERT INTO public.favorites (user_id, team_code)
SELECT p.id, t.code
FROM public.profiles p
JOIN public.teams t ON t.name = p.favorite_club_name
WHERE p.favorite_club_name IS NOT NULL
  AND p.favorite_club_name <> ''
ON CONFLICT (user_id, team_code) DO NOTHING;

-- Also backfill from localStorage-derived team codes stored only in profiles
-- when name join fails but favorite_club_id hash was set (best-effort via teams).
