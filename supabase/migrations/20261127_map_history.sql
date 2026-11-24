-- History for shared maps: older versions kept automatically, and a way back to one.
-- Apply separately, after a backup and a check on a staging copy. Needs the earlier migrations applied first
-- (it uses updated_by from 20261126 and can_edit_team from 20261125).
--
-- How it works: when someone saves a change to a shared map, the version being replaced is kept, but no more often than
-- once every 15 minutes, and only the newest 20 are kept per map. So history reaches back hours or days of active editing,
-- not every keystroke. Private maps keep no history. Going back to a version first keeps the current one, so it can be undone.
-- Space: a map can be a few megabytes, so 20 versions of a large shared map can be tens of megabytes. Watch the database size.
begin;

create table if not exists public.map_versions (
  id       uuid primary key default gen_random_uuid(),
  map_id   uuid not null references public.maps(id) on delete cascade,
  team_id  uuid not null references public.teams(id) on delete cascade,
  saved_by uuid references auth.users(id) on delete set null,
  saved_at timestamptz not null,
  title    text not null,
  data     jsonb not null
);
create index if not exists map_versions_map_idx on public.map_versions (map_id, saved_at desc);

alter table public.map_versions enable row level security;
revoke all on public.map_versions from authenticated, anon;
grant select on public.map_versions to authenticated;
-- Read only, for the team, and only while the map is still shared. Nothing is written except by the functions below.
drop policy if exists "team reads history of shared maps" on public.map_versions;
create policy "team reads history of shared maps"
  on public.map_versions for select
  using (is_team_member(team_id)
         and exists (select 1 from public.maps m where m.id = map_id and m.scope = 'team'));

-- Keeps the given state of a map as a version (shared maps only). Not forced: skipped if a version was kept in the last 15 minutes.
create or replace function public.snapshot_map_version(m public.maps, p_force boolean)
returns void language plpgsql security definer set search_path = public as $$
declare last_at timestamptz;
begin
  if m.scope <> 'team' then return; end if;
  select max(saved_at) into last_at from public.map_versions where map_id = m.id;
  if last_at is not null and (m.updated_at <= last_at
      or (not p_force and m.updated_at - last_at < interval '15 minutes')) then
    return;
  end if;
  insert into public.map_versions (map_id, team_id, saved_by, saved_at, title, data)
  values (m.id, m.team_id, m.updated_by, m.updated_at, m.title, m.data);
  delete from public.map_versions
   where map_id = m.id
     and id not in (select id from public.map_versions where map_id = m.id order by saved_at desc limit 20);
end;
$$;
revoke all on function public.snapshot_map_version(public.maps, boolean) from public;

create or replace function public.keep_map_version()
returns trigger language plpgsql as $$
begin
  perform public.snapshot_map_version(old, false);
  return new;
end;
$$;

drop trigger if exists maps_keep_version on public.maps;
create trigger maps_keep_version before update on public.maps
  for each row when (old.data is distinct from new.data)
  execute function public.keep_map_version();

-- Go back to a kept version. Owners and members can; viewers and outsiders cannot. The current version is kept first.
create or replace function public.restore_map_version(p_version uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v public.map_versions%rowtype; m public.maps%rowtype;
begin
  select * into v from public.map_versions where id = p_version;
  if not found or not public.can_edit_team(v.team_id) then
    raise exception 'You cannot go back to that version' using errcode = 'insufficient_privilege';
  end if;
  select * into m from public.maps where id = v.map_id for update;
  if not found or m.scope <> 'team' then
    raise exception 'You cannot go back to that version' using errcode = 'insufficient_privilege';
  end if;
  if not public.team_subscription_active(m.team_id) then
    raise exception 'This team''s subscription has ended, so maps cannot be changed'
      using errcode = 'check_violation';
  end if;
  perform public.snapshot_map_version(m, true);
  update public.maps set data = v.data where id = m.id;
end;
$$;
revoke all on function public.restore_map_version(uuid) from public;
grant execute on function public.restore_map_version(uuid) to authenticated;

commit;
