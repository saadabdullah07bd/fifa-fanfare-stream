
CREATE POLICY "Server-only access" ON public.match_score_snapshots
  FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
