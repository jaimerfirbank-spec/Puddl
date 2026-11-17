-- Reviewed database hardening; apply separately after backup and staging checks.
begin;

create or replace function public.enforce_seat_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare used int; allowed int;
begin
  -- Serialize admissions to this team before counting its current members.
  select seats into allowed from public.teams where id = new.team_id for update;
  select count(*) into used from public.team_members where team_id = new.team_id;
  if used >= allowed then
    raise exception 'Team is full: % of % seats used', used, allowed
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;


create or replace function public.enforce_map_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare used int; allowed int;
begin
  if new.scope <> 'personal' or new.owner_id is null then
    return new;
  end if;
  -- Serialize this owner's inserts, including requests from different tabs.
  perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text, 0));
  select count(*) into used
    from public.maps
   where owner_id = new.owner_id and scope = 'personal';
  select maps_per_user into allowed from public.teams where id = new.team_id;
  if used >= coalesce(allowed, 25) then
    raise exception 'Map limit reached: % of % maps used. Delete one, or ask for more.', used, allowed
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;


-- Map identity changes need an explicit administrative operation. Normal
-- client updates may edit content, but cannot take ownership of a team map,
-- turn a private map into a shared one, or move it between teams.
create or replace function public.protect_map_identity()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.role() = 'authenticated'
     and (new.team_id is distinct from old.team_id
          or new.owner_id is distinct from old.owner_id
          or new.scope is distinct from old.scope) then
    raise exception 'Map ownership, team and scope cannot be changed through the app'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists maps_protect_identity on public.maps;
create trigger maps_protect_identity before update on public.maps
  for each row execute function public.protect_map_identity();

commit;
