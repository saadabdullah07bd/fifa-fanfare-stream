import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { saveXtreamConfig, getXtreamConfig, refreshChannels, isAdmin } from "@/lib/xtream.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Pitch26" }] }),
  component: Settings,
});

function Settings() {
  const navigate = useNavigate();
  const saveFn = useServerFn(saveXtreamConfig);
  const getFn = useServerFn(getXtreamConfig);
  const refreshFn = useServerFn(refreshChannels);
  const adminFn = useServerFn(isAdmin);

  const { data: cfg, refetch } = useQuery({ queryKey: ["xtream-cfg"], queryFn: () => getFn() });
  const { data: adminInfo } = useQuery({ queryKey: ["is-admin"], queryFn: () => adminFn() });
  const admin = !!adminInfo?.admin;

  const [host, setHost] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const save = useMutation({
    mutationFn: () => saveFn({ data: { host, username, password } }),
    onSuccess: async () => {
      toast.success("Server saved");
      setPassword("");
      await refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const refresh = useMutation({
    mutationFn: () => refreshFn(),
    onSuccess: (r) => toast.success(`Loaded ${r.channels} channels across ${r.categories} categories`),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="display text-5xl">Settings</h1>
      <p className="mt-2 text-muted-foreground">Your account and (for admins) the shared Xtream server.</p>

      {!admin && (
        <div className="mt-6 rounded-lg border border-border bg-card/40 p-4 text-sm">
          <p className="text-xs uppercase tracking-wider text-primary">Viewer</p>
          <p className="mt-1">You're signed in. Live TV channels are managed by the site admin.</p>
        </div>
      )}

      {admin && (
        <>
          {cfg && (
            <div className="mt-6 rounded-lg border border-border bg-card/40 p-4">
              <p className="text-xs uppercase tracking-wider text-primary">Xtream connected</p>
              <p className="mt-1 font-semibold">{cfg.host}</p>
              <p className="text-sm text-muted-foreground">User: {cfg.username}</p>
              <button
                onClick={() => refresh.mutate()}
                disabled={refresh.isPending}
                className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
              >
                {refresh.isPending ? "Fetching…" : "Refresh channels"}
              </button>
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="mt-8 space-y-3">
            <h2 className="display text-2xl">{cfg ? "Update Xtream server" : "Add Xtream server"}</h2>
            <input
              required
              placeholder="http://your-server.example:8080"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              className="w-full rounded-md border border-border bg-input px-3 py-3 text-sm"
            />
            <input
              required
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-md border border-border bg-input px-3 py-3 text-sm"
            />
            <input
              required
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-border bg-input px-3 py-3 text-sm"
            />
            <button
              disabled={save.isPending}
              className="rounded-md bg-primary px-4 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
            >
              {save.isPending ? "Saving…" : "Save server"}
            </button>
          </form>
        </>
      )}

      <button
        onClick={async () => {
          await supabase.auth.signOut();
          navigate({ to: "/" });
        }}
        className="mt-12 text-xs uppercase tracking-wider text-muted-foreground hover:text-destructive"
      >
        Sign out
      </button>
    </div>
  );
}
