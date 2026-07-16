import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import { Seo } from "@/lib/seo";
import { toast } from "sonner";

/**
 * Settings page — user account controls and, for admins, shared Xtream
 * server credentials and the default Live TV channel selector.
 */

type Channel = { id: string; category: string; stream_id: string; name: string };

export default function Settings() {
  const navigate = useNavigate();
  const { user, ready, authed } = useAuth();
  const { admin } = useIsAdmin();
  const qc = useQueryClient();

  const { data: notifPrefs, refetch: refetchNotif } = useQuery({
    queryKey: ["notif-prefs", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("notif_match_events, notif_news")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ?? { notif_match_events: true, notif_news: true };
    },
    enabled: !!user,
  });

  const [notifMatch, setNotifMatch] = useState(true);
  const [notifNews, setNotifNews] = useState(true);

  useEffect(() => {
    if (!notifPrefs) return;
    setNotifMatch(notifPrefs.notif_match_events ?? true);
    setNotifNews(notifPrefs.notif_news ?? true);
  }, [notifPrefs]);

  const saveNotif = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ notif_match_events: notifMatch, notif_news: notifNews })
        .eq("id", user!.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success("Notification preferences saved");
      await refetchNotif();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  };

  // Xtream server credentials + current default channel (admin-only fetch).
  const { data: cfg, refetch } = useQuery({
    queryKey: ["xtream-cfg"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("xtream", {
        body: { action: "get_config" },
      });
      if (error) return null;
      return data as { host: string; username: string; default_stream_id: string | null } | null;
    },
    enabled: admin,
  });

  // Full channel list — used by the default-channel selector below.
  const { data: channels = [] } = useQuery({
    queryKey: ["channels-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channels")
        .select("id, category, stream_id, name")
        .order("category")
        .order("name");
      if (error) throw new Error(error.message);
      return (data ?? []) as Channel[];
    },
    enabled: admin,
  });

  const [host, setHost] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [defaultStreamId, setDefaultStreamId] = useState<string>("");

  useEffect(() => {
    if (!cfg) return;
    setHost(cfg.host ?? "");
    setUsername(cfg.username ?? "");
    setDefaultStreamId(cfg.default_stream_id ?? "");
  }, [cfg]);

  const save = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("xtream", {
        body: { action: "save_config", host, username, password },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: async () => {
      toast.success("Server saved");
      setPassword("");
      await refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [manualName, setManualName] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [manualCategory, setManualCategory] = useState("wc2026");
  const addManual = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("xtream", {
        body: {
          action: "add_manual_channel",
          name: manualName,
          url: manualUrl,
          category: manualCategory,
        },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: async () => {
      toast.success("Manual channel added");
      setManualName("");
      setManualUrl("");
      await qc.invalidateQueries({ queryKey: ["channels-admin"] });
      await qc.invalidateQueries({ queryKey: ["channels"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const refresh = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("xtream", {
        body: { action: "refresh_channels" },
      });
      if (error) throw new Error(error.message);
      return data as { categories: number; channels: number };
    },
    onSuccess: (r) =>
      toast.success(`Loaded ${r.channels} channels across ${r.categories} categories`),
    onError: (e: Error) => toast.error(e.message),
  });

  // Persist the default channel via edge function. Invalidates the
  // public "default-channel" query so LiveTV picks it up immediately.
  const saveDefault = useMutation({
    mutationFn: async (streamId: string) => {
      const { data, error } = await supabase.functions.invoke("xtream", {
        body: { action: "set_default_channel", streamId: streamId || null },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: async () => {
      toast.success("Default channel updated");
      await qc.invalidateQueries({ queryKey: ["default-channel"] });
      await refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Seo title="Settings — Pitch26" />
      <h1 className="display text-5xl">Settings</h1>
      {admin && <p className="mt-2 text-muted-foreground">Shared Xtream server controls.</p>}

      {ready && authed && (
        <section className="mt-8 rounded-lg border border-border bg-card/40 p-4">
          <h2 className="display text-2xl">Notifications</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose which push alerts you receive on this device.
          </p>
          <label className="mt-4 flex cursor-pointer items-center justify-between gap-4 rounded-md border border-border bg-background/40 px-4 py-3">
            <span className="text-sm font-medium">Match events (goals, kickoffs, full-time)</span>
            <input
              type="checkbox"
              checked={notifMatch}
              onChange={(e) => setNotifMatch(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
          </label>
          <label className="mt-2 flex cursor-pointer items-center justify-between gap-4 rounded-md border border-border bg-background/40 px-4 py-3">
            <span className="text-sm font-medium">News headlines</span>
            <input
              type="checkbox"
              checked={notifNews}
              onChange={(e) => setNotifNews(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
          </label>
          <button
            type="button"
            onClick={() => saveNotif.mutate()}
            disabled={
              saveNotif.isPending ||
              (notifMatch === (notifPrefs?.notif_match_events ?? true) &&
                notifNews === (notifPrefs?.notif_news ?? true))
            }
            className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
          >
            {saveNotif.isPending ? "Saving…" : "Save notifications"}
          </button>
        </section>
      )}

      {!admin && authed && (
        <button
          onClick={signOut}
          className="mt-6 rounded-md bg-primary px-4 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground"
        >
          Sign out
        </button>
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

          {/* Default channel selector — shown once channels are loaded. */}
          {channels.length > 0 && (
            <div className="mt-6 rounded-lg border border-border bg-card/40 p-4">
              <h2 className="display text-2xl">Default Live TV channel</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose which channel auto-plays for every viewer on the Live TV page.
              </p>
              <select
                value={defaultStreamId}
                onChange={(e) => setDefaultStreamId(e.target.value)}
                className="mt-3 w-full rounded-md border border-border bg-input px-3 py-3 text-sm"
              >
                <option value="">Auto (TSN 1 if available)</option>
                {channels.map((c) => (
                  <option key={c.id} value={c.stream_id}>
                    {c.name} — {c.category}
                  </option>
                ))}
              </select>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => saveDefault.mutate(defaultStreamId)}
                  disabled={
                    saveDefault.isPending || defaultStreamId === (cfg?.default_stream_id ?? "")
                  }
                  className="rounded-md bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
                >
                  {saveDefault.isPending ? "Saving…" : "Save default"}
                </button>
                {cfg?.default_stream_id && (
                  <button
                    onClick={() => {
                      setDefaultStreamId("");
                      saveDefault.mutate("");
                    }}
                    disabled={saveDefault.isPending}
                    className="rounded-md border border-border px-4 py-2 text-sm font-bold uppercase tracking-wider text-muted-foreground hover:text-destructive disabled:opacity-50"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
            className="mt-8 space-y-3"
          >
            <h2 className="display text-2xl">
              {cfg ? "Update Xtream server" : "Add Xtream server"}
            </h2>
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
              type="password"
              placeholder={cfg ? "Password (leave blank to keep current)" : "Password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={!cfg}
              className="w-full rounded-md border border-border bg-input px-3 py-3 text-sm"
            />
            <button
              disabled={save.isPending}
              className="rounded-md bg-primary px-4 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
            >
              {save.isPending ? "Saving…" : "Save server"}
            </button>
          </form>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              addManual.mutate();
            }}
            className="mt-8 space-y-3 rounded-lg border border-border bg-card/40 p-4"
          >
            <h2 className="display text-2xl">Add manual channel</h2>
            <p className="text-sm text-muted-foreground">
              Paste a direct HLS (.m3u8) or MPEG-TS (.ts) link — bypasses the Xtream server.
            </p>
            <input
              required
              placeholder="Channel name (e.g. TSN 1)"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              maxLength={128}
              className="w-full rounded-md border border-border bg-input px-3 py-3 text-sm"
            />
            <input
              required
              placeholder="https://example.com/stream.m3u8"
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              maxLength={1024}
              className="w-full rounded-md border border-border bg-input px-3 py-3 text-sm"
            />
            <select
              value={manualCategory}
              onChange={(e) => setManualCategory(e.target.value)}
              className="w-full rounded-md border border-border bg-input px-3 py-3 text-sm"
            >
              <option value="wc2026">World Cup 2026</option>
              <option value="cricket">Cricket</option>
              <option value="other">Other</option>
            </select>
            <button
              disabled={addManual.isPending}
              className="rounded-md bg-primary px-4 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
            >
              {addManual.isPending ? "Adding…" : "Add channel"}
            </button>
          </form>
        </>
      )}

      {admin && (
        <button
          onClick={signOut}
          className="mt-12 text-xs uppercase tracking-wider text-muted-foreground hover:text-destructive"
        >
          Sign out
        </button>
      )}
    </div>
  );
}
