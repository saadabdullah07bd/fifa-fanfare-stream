CREATE OR REPLACE FUNCTION public.enforce_single_admin_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_email TEXT;
BEGIN
  IF NEW.role = 'admin' THEN
    SELECT lower(email) INTO target_email
    FROM auth.users
    WHERE id = NEW.user_id;

    IF target_email IS DISTINCT FROM 'saadabdullah07bd@gmail.com' THEN
      RAISE EXCEPTION 'Only saadabdullah07bd@gmail.com can be assigned admin access';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_single_admin_email_on_user_roles ON public.user_roles;
CREATE TRIGGER enforce_single_admin_email_on_user_roles
BEFORE INSERT OR UPDATE OF user_id, role ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_single_admin_email();

CREATE OR REPLACE FUNCTION public.remove_admin_when_email_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(NEW.email) <> 'saadabdullah07bd@gmail.com' THEN
    DELETE FROM public.user_roles
    WHERE user_id = NEW.id
      AND role = 'admin';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS remove_admin_when_email_changes_on_auth_users ON auth.users;
CREATE TRIGGER remove_admin_when_email_changes_on_auth_users
AFTER UPDATE OF email ON auth.users
FOR EACH ROW
WHEN (lower(OLD.email) IS DISTINCT FROM lower(NEW.email))
EXECUTE FUNCTION public.remove_admin_when_email_changes();

REVOKE EXECUTE ON FUNCTION public.enforce_single_admin_email() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.remove_admin_when_email_changes() FROM PUBLIC, anon, authenticated;