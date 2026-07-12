import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

/**
 * Hook to access the current authenticated user and auth state readiness.
 * 
 * @returns An object containing the current user, a ready flag, and an authed boolean.
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);
  return { user, ready, authed: !!user };
}

/**
 * Hook to check if the current user has the 'admin' role.
 * 
 * @returns An object containing the admin status and auth readiness flag.
 */
export function useIsAdmin() {
  const { user, ready } = useAuth();
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    if (!user) { setAdmin(false); return; }
    supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setAdmin(!!data));
  }, [user]);
  return { admin, ready };
}
