
DROP POLICY IF EXISTS "predictions public read" ON public.predictions;
CREATE POLICY "own predictions read" ON public.predictions FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "profiles public read" ON public.profiles;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);

REVOKE SELECT ON public.predictions FROM anon;
REVOKE SELECT ON public.profiles FROM anon;
