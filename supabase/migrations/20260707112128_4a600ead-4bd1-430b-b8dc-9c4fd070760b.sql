ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS favorite_club_id INT,
  ADD COLUMN IF NOT EXISTS favorite_club_name TEXT,
  ADD COLUMN IF NOT EXISTS favorite_club_logo TEXT,
  ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;