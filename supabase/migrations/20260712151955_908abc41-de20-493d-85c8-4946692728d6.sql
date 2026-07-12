
-- Enum for platform
DO $$ BEGIN
  CREATE TYPE public.push_platform AS ENUM ('web','android','ios');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1) push_tokens
CREATE TABLE public.push_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  token TEXT NOT NULL,
  platform public.push_platform NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (token)
);
CREATE INDEX push_tokens_user_id_idx ON public.push_tokens(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_tokens TO authenticated;
GRANT ALL ON public.push_tokens TO service_role;

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own push tokens"
  ON public.push_tokens FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2) notification_log
CREATE TABLE public.notification_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,             -- 'kickoff' | 'goal' | 'final' | 'news'
  match_no INT,
  news_id UUID,
  dedupe_key TEXT NOT NULL,       -- e.g. 'kickoff:42', 'goal:42:1-0', 'news:<uuid>'
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, dedupe_key)
);
CREATE INDEX notification_log_sent_at_idx ON public.notification_log(sent_at DESC);

GRANT SELECT ON public.notification_log TO authenticated;
GRANT ALL ON public.notification_log TO service_role;

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own notification history"
  ON public.notification_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 3) match_score_snapshots
CREATE TABLE public.match_score_snapshots (
  match_no INT NOT NULL PRIMARY KEY,
  home_score INT NOT NULL DEFAULT 0,
  away_score INT NOT NULL DEFAULT 0,
  status TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.match_score_snapshots TO service_role;

ALTER TABLE public.match_score_snapshots ENABLE ROW LEVEL SECURITY;
-- no policies: server-only

-- 4) profile toggles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notif_match_events BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_news BOOLEAN NOT NULL DEFAULT true;
