-- Sharing a map with your team, and making it private again.
-- Apply separately, after a backup and a check on a staging copy. Needs supabase/schema.sql and
-- 20261117_reliable_map_limits.sql applied first.
--
-- A map's scope (personal or team) is part of its identity, and the app may not change it directly: that
-- is what 20261117 enforces. These two functions are the only way, and they check who is asking.
begin;

-- The identity guard now blocks direct changes from the app (the 'authenticated' role) but lets the
-- functions below through: inside a security definer function the current user is the function's owner.
create or replace function public.protect_map_identity()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.role() = 'authenticated' and current_user in ('authenticated', 'anon')
     and (new.team_id is distinct from old.team_id
          or new.owner_id is distinct from old.owner_id
          or new.scope is distinct from old.scope) then
    raise exception 'Map ownership, team and scope cannot be changed through the app'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

-- Only the person who made a map can share it, and only while the team's subscription is live.
create or replace function public.share_map(p_map uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m public.maps%rowtype;
begin
  select * into m from public.maps where id = p_map for update;
  if not found or m.owner_id is distinct from auth.uid() or not public.is_team_member(m.team_id) then
    raise exception 'Only the person who made a map can share it with their team'
      using errcode = 'insufficient_privilege';
  end if;
  if not public.team_subscription_active(m.team_id) then
    raise exception 'This team''s subscription has ended, so maps cannot be shared'
      using errcode = 'check_violation';
  end if;
  update public.maps set scope = 'team' where id = p_map;
end;
$$;

-- The person who made it, or the team owner, can make a shared map private again. It goes back to its
-- maker (or, if the maker has left, to the team owner, so it cannot be lost). The maker's map limit applies.
create or replace function public.unshare_map(p_map uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m public.maps%rowtype; maker uuid; used int; allowed int;
begin
  select * into m from public.maps where id = p_map for update;
  if not found or m.scope <> 'team' or not public.is_team_member(m.team_id)
     or not (m.owner_id is not distinct from auth.uid() or public.is_team_owner(m.team_id)) then
    raise exception 'Only the person who made a shared map, or the team owner, can make it private'
      using errcode = 'insufficient_privilege';
  end if;
  maker := coalesce(m.owner_id, auth.uid());
  perform pg_advisory_xact_lock(hashtextextended(maker::text, 0));
  select count(*) into used from public.maps where owner_id = maker and scope = 'personal';
  select maps_per_user into allowed from public.teams where id = m.team_id;
  if used >= coalesce(allowed, 25) then
    raise exception 'Map limit reached: % of % private maps used. Delete one first.', used, allowed
      using errcode = 'check_violation';
  end if;
  update public.maps set scope = 'personal', owner_id = maker where id = p_map;
end;
$$;

revoke all on function public.share_map(uuid) from public;
revoke all on function public.unshare_map(uuid) from public;
grant execute on function public.share_map(uuid) to authenticated;
grant execute on function public.unshare_map(uuid) to authenticated;

commit;
