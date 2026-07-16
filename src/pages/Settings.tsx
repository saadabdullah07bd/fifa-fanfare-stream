import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import { Seo } from "@/lib/seo";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bell, LogOut, Radio, RefreshCw, Server, Tv } from "lucide-react";

/**
 * Settings page — user notification prefs and, for admins, Xtream controls
 * with a portal-based channel picker (avoids clipped native <select> menus).
 */

type Channel = { id: string; category: string; stream_id: string; name: string };

const CATEGORY_LABEL: Record<string, string> = {
  wc2026: "FIFA World Cup 2026",
  bein: "beIN Sports",
  cricket: "Cricket",
  other: "Other",
};

function categoryLabel(c: string) {
  return CATEGORY_LABEL[c] ?? c;
}

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

  const channelsByCategory = useMemo(() => {
    const map = new Map<string, Channel[]>();
    for (const c of channels) {
      const key = c.category || "other";
      const arr = map.get(key) ?? [];
      arr.push(c);
      map.set(key, arr);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [channels]);

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
    onSuccess: async (r) => {
      toast.success(`Loaded ${r.channels} channels (${r.categories} categories)`);
      await qc.invalidateQueries({ queryKey: ["channels-admin"] });
      await qc.invalidateQueries({ queryKey: ["channels"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

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

  const fieldClass =
    "w-full rounded-xl border border-border/80 bg-background/70 px-3.5 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";
  const cardClass = "rounded-2xl border border-border/70 bg-card/50 p-5 shadow-sm backdrop-blur-sm";

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-12">
      <Seo title="Settings — Pitch26" />
      <header className="mb-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-primary">Account</p>
        <h1 className="display mt-1 text-4xl sm:text-5xl">Settings</h1>
        {admin && (
          <p className="mt-2 text-sm text-muted-foreground">
            Admin controls for Live TV — World Cup 2026 &amp; beIN Sports only.
          </p>
        )}
      </header>

      {ready && authed && (
        <section className={`${cardClass} space-y-4`}>
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <h2 className="display text-2xl">Notifications</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Choose which push alerts you receive on this device.
          </p>
          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border/60 bg-background/40 px-4 py-3.5">
            <span className="text-sm font-medium">Match events (goals, kickoffs, full-time)</span>
            <input
              type="checkbox"
              checked={notifMatch}
              onChange={(e) => setNotifMatch(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
          </label>
          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border/60 bg-background/40 px-4 py-3.5">
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
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
          >
            {saveNotif.isPending ? "Saving…" : "Save notifications"}
          </button>
        </section>
      )}

      {admin && (
        <div className="mt-8 space-y-6">
          {cfg && (
            <section className={cardClass}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
                    <Server className="h-3.5 w-3.5" /> Xtream connected
                  </div>
                  <p className="mt-2 break-all font-semibold">{cfg.host}</p>
                  <p className="text-sm text-muted-foreground">User: {cfg.username}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {channels.length} channels in catalogue
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => refresh.mutate()}
                  disabled={refresh.isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${refresh.isPending ? "animate-spin" : ""}`} />
                  {refresh.isPending ? "Refreshing…" : "Refresh channels"}
                </button>
              </div>
            </section>
          )}

          <section className={`${cardClass} space-y-4`}>
            <div className="flex items-center gap-2">
              <Tv className="h-4 w-4 text-primary" />
              <h2 className="display text-2xl">Default Live TV channel</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Featured channel on the Live TV page. Menu opens above the page so it never gets
              clipped.
            </p>
            <Select
              value={defaultStreamId || "__auto__"}
              onValueChange={(v) => setDefaultStreamId(v === "__auto__" ? "" : v)}
            >
              <SelectTrigger className="h-12 w-full rounded-xl border-border/80 bg-background/70 px-3.5 text-left text-sm">
                <SelectValue placeholder="Auto (first available)" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                sideOffset={6}
                className="z-[200] max-h-72 w-[var(--radix-select-trigger-width)] overflow-y-auto rounded-xl border-border bg-popover p-1 shadow-xl"
              >
                <SelectItem value="__auto__" className="rounded-lg py-2.5">
                  Auto (first available)
                </SelectItem>
                {channelsByCategory.map(([cat, list]) => (
                  <SelectGroup key={cat}>
                    <SelectLabel className="px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-primary">
                      {categoryLabel(cat)}
                    </SelectLabel>
                    {list.map((c) => (
                      <SelectItem key={c.id} value={c.stream_id} className="rounded-lg py-2.5">
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => saveDefault.mutate(defaultStreamId)}
                disabled={
                  saveDefault.isPending || defaultStreamId === (cfg?.default_stream_id ?? "")
                }
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
              >
                {saveDefault.isPending ? "Saving…" : "Save default"}
              </button>
              {cfg?.default_stream_id && (
                <button
                  type="button"
                  onClick={() => {
                    setDefaultStreamId("");
                    saveDefault.mutate("");
                  }}
                  disabled={saveDefault.isPending}
                  className="rounded-xl border border-border px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-muted-foreground hover:text-destructive disabled:opacity-50"
                >
                  Clear
                </button>
              )}
            </div>
          </section>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
            className={`${cardClass} space-y-3`}
          >
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-primary" />
              <h2 className="display text-2xl">
                {cfg ? "Update Xtream server" : "Add Xtream server"}
              </h2>
            </div>
            <input
              required
              placeholder="http://your-server.example:8080"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              className={fieldClass}
            />
            <input
              required
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={fieldClass}
            />
            <input
              type="password"
              placeholder={cfg ? "Password (leave blank to keep current)" : "Password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={!cfg}
              className={fieldClass}
            />
            <button
              type="submit"
              disabled={save.isPending}
              className="rounded-xl bg-primary px-4 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
            >
              {save.isPending ? "Saving…" : "Save server"}
            </button>
          </form>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              addManual.mutate();
            }}
            className={`${cardClass} space-y-3`}
          >
            <h2 className="display text-2xl">Add manual channel</h2>
            <p className="text-sm text-muted-foreground">
              Paste a direct HLS (.m3u8) or MPEG-TS (.ts) link — bypasses the Xtream server.
            </p>
            <input
              required
              placeholder="Channel name (e.g. beIN Sports 1)"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              maxLength={128}
              className={fieldClass}
            />
            <input
              required
              placeholder="https://example.com/stream.m3u8"
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              maxLength={1024}
              className={fieldClass}
            />
            <Select value={manualCategory} onValueChange={setManualCategory}>
              <SelectTrigger className="h-12 w-full rounded-xl border-border/80 bg-background/70 px-3.5 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                position="popper"
                className="z-[200] rounded-xl border-border bg-popover shadow-xl"
              >
                <SelectItem value="wc2026">FIFA World Cup 2026</SelectItem>
                <SelectItem value="bein">beIN Sports</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <button
              type="submit"
              disabled={addManual.isPending}
              className="rounded-xl bg-primary px-4 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
            >
              {addManual.isPending ? "Adding…" : "Add channel"}
            </button>
          </form>
        </div>
      )}

      {authed && (
        <button
          type="button"
          onClick={signOut}
          className="mt-10 inline-flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-destructive"
        >
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      )}
    </div>
  );
}
