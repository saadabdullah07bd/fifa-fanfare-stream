
ALTER TABLE public.notification_log DROP COLUMN IF EXISTS match_no;
ALTER TABLE public.notification_log ADD COLUMN IF NOT EXISTS match_id UUID;

DROP TABLE IF EXISTS public.match_score_snapshots;
CREATE TABLE public.match_score_snapshots (
  match_id UUID NOT NULL PRIMARY KEY,
  home_score INT NOT NULL DEFAULT 0,
  away_score INT NOT NULL DEFAULT 0,
  status TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.match_score_snapshots TO service_role;
ALTER TABLE public.match_score_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Server-only access" ON public.match_score_snapshots
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
