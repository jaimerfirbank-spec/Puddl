-- View-only members, and managing the team's roster.
-- Apply separately, after a backup and a check on a staging copy. Needs supabase/schema.sql,
-- 20261117_reliable_map_limits.sql and 20261124_share_maps.sql applied first.
--
-- Three roles: owner (everything), member (read and edit shared maps, make their own) and viewer (read only).
-- Adding people stays a hand job in the Supabase SQL editor. This migration makes removing people and changing
-- roles safe, and lets a team see who is in it.
begin;

alter table public.team_members drop constraint if exists team_members_role_check;
alter table public.team_members add constraint team_members_role_check check (role in ('owner','member','viewer'));

-- True for owners and members, false for viewers and for people outside the team.
create or replace function public.can_edit_team(p_team uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team_members
                 where team_id = p_team and user_id = auth.uid() and role in ('owner','member'));
$$;

-- Viewers can read shared maps but cannot make, change or share anything.
drop policy if exists "create maps in your team" on public.maps;
create policy "create maps in your team"
  on public.maps for insert
  with check (is_team_member(team_id) and can_edit_team(team_id)
              and owner_id = auth.uid()
              and team_subscription_active(team_id));

drop policy if exists "edit own and team maps" on public.maps;
create policy "edit own and team maps"
  on public.maps for update
  using (is_team_member(team_id) and can_edit_team(team_id)
         and (scope = 'team' or owner_id = auth.uid())
         and team_subscription_active(team_id))
  with check (is_team_member(team_id) and can_edit_team(team_id)
              and (scope = 'team' or owner_id = auth.uid()));

drop policy if exists "team uploads images" on storage.objects;
create policy "team uploads images"
  on storage.objects for insert
  with check (bucket_id = 'map-images'
              and public.can_edit_team(((storage.foldername(name))[1])::uuid));

-- The owner can add members and viewers through the app's own rules, but never another owner.
drop policy if exists "owner adds colleagues" on public.team_members;
create policy "owner adds colleagues"
  on public.team_members for insert
  with check (is_team_owner(team_id) and role in ('member','viewer'));

-- Removing people goes through remove_team_member() below, so their shared maps are looked after.
drop policy if exists "owner removes colleagues" on public.team_members;
revoke delete on public.team_members from authenticated;

create or replace function public.share_map(p_map uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m public.maps%rowtype;
begin
  select * into m from public.maps where id = p_map for update;
  if not found or m.owner_id is distinct from auth.uid() or not public.can_edit_team(m.team_id) then
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

create or replace function public.unshare_map(p_map uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m public.maps%rowtype; maker uuid; used int; allowed int;
begin
  select * into m from public.maps where id = p_map for update;
  if not found or m.scope <> 'team' or not public.can_edit_team(m.team_id)
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

-- Who is in my team. Any member can see it; the email comes from the account, which the app cannot read directly.
create or replace function public.team_roster(p_team uuid)
returns table (user_id uuid, email text, role text, added_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_team_member(p_team) then
    raise exception 'Not a member of this team' using errcode = 'insufficient_privilege';
  end if;
  return query
    select m.user_id, u.email::text, m.role, m.added_at
      from public.team_members m join auth.users u on u.id = m.user_id
     where m.team_id = p_team
     order by (m.role = 'owner') desc, u.email;
end;
$$;

-- Owner only. Switches someone between member and viewer. Owners keep their role; the owner role is changed by hand.
create or replace function public.set_member_role(p_team uuid, p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_team_owner(p_team) then
    raise exception 'Only the team owner can change roles' using errcode = 'insufficient_privilege';
  end if;
  if p_role not in ('member','viewer') then
    raise exception 'Role must be member or viewer' using errcode = 'invalid_parameter_value';
  end if;
  update public.team_members set role = p_role
   where team_id = p_team and user_id = p_user and role <> 'owner';
  if not found then
    raise exception 'That person is not a member, or is an owner' using errcode = 'no_data_found';
  end if;
end;
$$;

-- Owner only. Takes someone out of the team. Shared maps they made stay with the team (the maker is cleared, so
-- making one private later hands it to whoever asks, not to the person who left). Their private maps are left
-- untouched in the database but nobody on the team can see them; they come back if the person is added again.
create or replace function public.remove_team_member(p_team uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_team_owner(p_team) then
    raise exception 'Only the team owner can remove people' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.team_members where team_id = p_team and user_id = p_user and role <> 'owner') then
    raise exception 'That person is not a member, or is an owner' using errcode = 'no_data_found';
  end if;
  update public.maps set owner_id = null where team_id = p_team and owner_id = p_user and scope = 'team';
  delete from public.team_members where team_id = p_team and user_id = p_user;
end;
$$;

revoke all on function public.team_roster(uuid) from public;
revoke all on function public.set_member_role(uuid, uuid, text) from public;
revoke all on function public.remove_team_member(uuid, uuid) from public;
grant execute on function public.can_edit_team(uuid) to authenticated;
grant execute on function public.team_roster(uuid) to authenticated;
grant execute on function public.set_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.remove_team_member(uuid, uuid) to authenticated;

commit;
