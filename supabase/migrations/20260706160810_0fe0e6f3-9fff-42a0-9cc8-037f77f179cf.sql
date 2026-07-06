
-- Teams
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  "group" TEXT,
  confederation TEXT,
  flag_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.teams TO anon, authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teams are public" ON public.teams FOR SELECT USING (true);

-- Venues
CREATE TABLE public.venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  capacity INT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.venues TO anon, authenticated;
GRANT ALL ON public.venues TO service_role;
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Venues are public" ON public.venues FOR SELECT USING (true);

-- Matches
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT UNIQUE,
  stage TEXT NOT NULL,
  "group" TEXT,
  date_utc TIMESTAMPTZ NOT NULL,
  home_team_code TEXT REFERENCES public.teams(code),
  away_team_code TEXT REFERENCES public.teams(code),
  home_score INT,
  away_score INT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  minute TEXT,
  venue_id UUID REFERENCES public.venues(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.matches TO anon, authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Matches are public" ON public.matches FOR SELECT USING (true);
CREATE INDEX matches_date_idx ON public.matches(date_utc);
CREATE INDEX matches_status_idx ON public.matches(status);

-- Standings
CREATE TABLE public.standings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "group" TEXT NOT NULL,
  team_code TEXT NOT NULL REFERENCES public.teams(code),
  played INT DEFAULT 0,
  w INT DEFAULT 0,
  d INT DEFAULT 0,
  l INT DEFAULT 0,
  gf INT DEFAULT 0,
  ga INT DEFAULT 0,
  gd INT DEFAULT 0,
  pts INT DEFAULT 0,
  UNIQUE("group", team_code)
);
GRANT SELECT ON public.standings TO anon, authenticated;
GRANT ALL ON public.standings TO service_role;
ALTER TABLE public.standings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Standings are public" ON public.standings FOR SELECT USING (true);

-- Scorers
CREATE TABLE public.scorers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player TEXT NOT NULL,
  team_code TEXT REFERENCES public.teams(code),
  goals INT DEFAULT 0,
  assists INT DEFAULT 0,
  UNIQUE(player, team_code)
);
GRANT SELECT ON public.scorers TO anon, authenticated;
GRANT ALL ON public.scorers TO service_role;
ALTER TABLE public.scorers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scorers are public" ON public.scorers FOR SELECT USING (true);

-- News
CREATE TABLE public.news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  url TEXT UNIQUE NOT NULL,
  source TEXT,
  image_url TEXT,
  summary TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.news TO anon, authenticated;
GRANT ALL ON public.news TO service_role;
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;
CREATE POLICY "News is public" ON public.news FOR SELECT USING (true);

-- Xtream user configuration (per-user)
CREATE TABLE public.xtream_config (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  host TEXT NOT NULL,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.xtream_config TO authenticated;
GRANT ALL ON public.xtream_config TO service_role;
ALTER TABLE public.xtream_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own xtream config" ON public.xtream_config
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Channels cache (per-user)
CREATE TABLE public.channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- 'wc2026' | 'cricket'
  stream_id TEXT NOT NULL,
  name TEXT NOT NULL,
  logo_url TEXT,
  epg_channel_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, stream_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channels TO authenticated;
GRANT ALL ON public.channels TO service_role;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own channels" ON public.channels
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Scrape runs (tracks last refresh)
CREATE TABLE public.scrape_runs (
  source TEXT PRIMARY KEY,
  last_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT,
  detail TEXT
);
GRANT SELECT ON public.scrape_runs TO anon, authenticated;
GRANT ALL ON public.scrape_runs TO service_role;
ALTER TABLE public.scrape_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scrape runs public read" ON public.scrape_runs FOR SELECT USING (true);
