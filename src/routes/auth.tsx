import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — Pitch26" }] }),
  component: Auth,
});

function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/settings" });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        toast.success("Account created — check your email if confirmation is required.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/settings" });
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) toast.error(result.error.message);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Link to="/" className="text-xs uppercase tracking-wider text-muted-foreground hover:text-primary">← back</Link>
      <h1 className="display mt-4 text-4xl">{mode === "signin" ? "Sign in" : "Create account"}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Needed to connect your Xtream server and save channels.</p>

      <button onClick={google} className="mt-6 w-full rounded-md border border-border bg-secondary px-4 py-3 text-sm font-semibold">
        Continue with Google
      </button>

      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={submit} className="space-y-3">
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="Email" className="w-full rounded-md border border-border bg-input px-3 py-3 text-sm" />
        <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Password" className="w-full rounded-md border border-border bg-input px-3 py-3 text-sm" />
        <button disabled={loading} className="w-full rounded-md bg-primary px-4 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50">
          {loading ? "…" : mode === "signin" ? "Sign in" : "Sign up"}
        </button>
      </form>
      <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="mt-4 w-full text-center text-xs uppercase tracking-wider text-muted-foreground hover:text-primary">
        {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
      </button>
    </div>
  );
}
