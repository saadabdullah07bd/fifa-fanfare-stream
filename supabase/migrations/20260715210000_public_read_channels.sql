-- Live TV was dead for every signed-out visitor.
--
-- `channels` had RLS policies for `authenticated` only, with nothing for `anon`.
-- A signed-out visitor therefore read zero channels, so LiveTV never auto-selected
-- a channel, `active` stayed null, and the player effect returned early — meaning
-- the `xtream` function was never even called and no video ever loaded. The edge
-- function logs confirmed this: zero xtream requests.
--
-- Channels are public catalogue data (name, category, logo). The stream itself is
-- NOT exposed by this: playback still requires an HMAC-signed, expiring token
-- minted by the `xtream` function, so read access here does not grant viewing.
--
-- `direct_url` is the one column that must never reach a browser: it holds a raw
-- upstream URL for manually-added channels, and Xtream URLs embed credentials in
-- the path (http://host:port/live/USERNAME/PASSWORD/123.ts). It is read only by
-- the `xtream` function via the service role, which bypasses RLS and these grants.
-- So rather than a blanket policy, column-level grants exclude it permanently —
-- a future manual channel cannot leak credentials even if someone selects "*".

-- Allow anyone (anon + authenticated) to read the channel catalogue.
drop policy if exists "authed can read channels" on public.channels;
drop policy if exists "public can read channels" on public.channels;
create policy "public can read channels"
  on public.channels
  for select
  to anon, authenticated
  using (true);

-- Column-level SELECT: everything except direct_url.
revoke select on public.channels from anon, authenticated;
grant select (id, category, stream_id, name, logo_url, epg_channel_id, updated_at)
  on public.channels to anon, authenticated;
