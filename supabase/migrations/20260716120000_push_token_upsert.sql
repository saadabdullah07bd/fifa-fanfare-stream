-- Reassign push tokens on login: a device token must follow the current user.
CREATE OR REPLACE FUNCTION public.upsert_push_token(p_token TEXT, p_platform public.push_platform)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
    RAISE EXCEPTION 'token required';
  END IF;

  DELETE FROM public.push_tokens WHERE token = p_token AND user_id <> auth.uid();

  INSERT INTO public.push_tokens (user_id, token, platform, last_seen_at)
  VALUES (auth.uid(), p_token, p_platform, now())
  ON CONFLICT (token) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        platform = EXCLUDED.platform,
        last_seen_at = EXCLUDED.last_seen_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_push_token(TEXT, public.push_platform) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_push_token(TEXT, public.push_platform) TO authenticated;
