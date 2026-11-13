-- Puddl — server-side storage, teams and access rules
-- Run once in the Supabase SQL Editor. Safe to re-run.
--
-- Commercial model this encodes:
--   A TEAM is the thing that gets sold. £1,000 buys one team 12 months and
--   5 seats. Teams hold their own budgets, so a team that buys must not be
--   able to hand access to another department.
--   Inside a team, each person's maps are their own.
--
--   SHARED TEAM MAPS ARE DEFERRED (decided 13 Nov 2026). The scope column and
--   the policies below already support them, but nothing in index.html turns
--   them on. Before enabling: Puddl autosaves the whole map as one blob, so
--   two people editing one map would silently overwrite each other. That needs
--   a stale-write guard first.
--
--   Distribution today is by view-only HTML export (saveShareFile) and PNG
--   snapshot, not by shared editing.
--
-- This mirrors the personal / team / combined modes already in index.html.
--
-- Teams and subscriptions are created by you, not by customers: there is
-- deliberately no policy letting anyone insert a team or edit seats and
-- renewal dates. Do that from the Supabase dashboard, which bypasses these
-- rules. Otherwise a customer could grant themselves 50 seats.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Teams — the billable unit
-- ──────────────────────────────────────────────────────────────────────────

create table if not exists public.teams (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  seats                int  not null default 5 check (seats > 0),
  -- null means no expiry. Set this 12 months out when an invoice is paid.
  subscription_ends_at timestamptz,
  created_at           timestamptz not null default now()
);

create table if not exists public.team_members (
  team_id  uuid not null references public.teams(id)   on delete cascade,
  user_id  uuid not null references auth.users(id)     on delete cascade,
  -- 'owner' is the person who can add and remove colleagues and delete the
  -- shared maps. Everyone else is 'member'.
  role     text not null default 'member' check (role in ('owner','member')),
  added_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Helpers
-- ──────────────────────────────────────────────────────────────────────────
-- security definer so these can read team_members without triggering that
-- table's own RLS, which would recurse. search_path is pinned, which is the
-- standard precaution for a definer function.

create or replace function public.is_team_member(p_team uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.team_members
                 where team_id = p_team and user_id = auth.uid());
$$;

create or replace function public.is_team_owner(p_team uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.team_members
                 where team_id = p_team and user_id = auth.uid() and role = 'owner');
$$;

create or replace function public.team_subscription_active(p_team uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select coalesce((select subscription_ends_at is null or subscription_ends_at > now()
                   from public.teams where id = p_team), false);
$$;

-- Enforce the 5-seat limit in the database, not in the app, so it holds even
-- if someone calls the API directly.
create or replace function public.enforce_seat_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare used int; allowed int;
begin
  select count(*) into used    from public.team_members where team_id = new.team_id;
  select seats    into allowed from public.teams        where id      = new.team_id;
  if used >= allowed then
    raise exception 'Team is full: % of % seats used', used, allowed
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists team_members_seat_limit on public.team_members;
create trigger team_members_seat_limit
  before insert on public.team_members
  for each row execute function public.enforce_seat_limit();

-- ──────────────────────────────────────────────────────────────────────────
-- 3. Maps
-- ──────────────────────────────────────────────────────────────────────────

create table if not exists public.maps (
  id         uuid primary key default gen_random_uuid(),

  -- Every map belongs to exactly one team. This is what stops a team sharing
  -- its licence with the department next door.
  team_id    uuid not null references public.teams(id) on delete cascade,

  -- Nullable on purpose: 'set null' rather than cascade, so a shared team map
  -- survives the person who created it leaving the council.
  -- NOTE: a 'personal' map whose owner is removed becomes invisible to
  -- everyone. Before removing a member, reassign or promote their personal
  -- maps to team scope.
  owner_id   uuid references auth.users(id) on delete set null,

  scope      text not null default 'personal' check (scope in ('personal','team')),
  title      text not null default 'Untitled map',
  kind       text not null default 'general'
             check (kind in ('general','network','systems','stakeholder','argument')),
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists maps_team_scope_idx on public.maps (team_id, scope, updated_at desc);
create index if not exists maps_owner_idx      on public.maps (owner_id, updated_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists maps_touch_updated_at on public.maps;
create trigger maps_touch_updated_at
  before update on public.maps
  for each row execute function public.touch_updated_at();

-- ──────────────────────────────────────────────────────────────────────────
-- 4. Row Level Security
-- ──────────────────────────────────────────────────────────────────────────
-- Postgres filters every query to what the signed-in user may see, so a bug
-- in index.html cannot leak another team's maps.

alter table public.teams        enable row level security;
alter table public.team_members enable row level security;
alter table public.maps         enable row level security;

-- Teams: members may look at their own team. Nobody may create or edit one
-- through the app; that is yours to do when an invoice is paid.
drop policy if exists "members read their team" on public.teams;
create policy "members read their team"
  on public.teams for select using (is_team_member(id));

-- Team members: visible to the team; managed by the team's owner.
drop policy if exists "members read the roster" on public.team_members;
create policy "members read the roster"
  on public.team_members for select using (is_team_member(team_id));

drop policy if exists "owner adds colleagues" on public.team_members;
create policy "owner adds colleagues"
  on public.team_members for insert with check (is_team_owner(team_id));

drop policy if exists "owner removes colleagues" on public.team_members;
create policy "owner removes colleagues"
  on public.team_members for delete using (is_team_owner(team_id));

-- Maps: your own private maps, plus every shared map in your team.
drop policy if exists "read own and team maps" on public.maps;
create policy "read own and team maps"
  on public.maps for select
  using (is_team_member(team_id) and (scope = 'team' or owner_id = auth.uid()));

-- Creating requires a live subscription. Reading does not: when a council
-- forgets to renew, they keep access to their work and lose the ability to
-- change it. Flip team_subscription_active() into the select policy above if
-- you would rather lock them out entirely.
drop policy if exists "create maps in your team" on public.maps;
create policy "create maps in your team"
  on public.maps for insert
  with check (is_team_member(team_id)
              and owner_id = auth.uid()
              and team_subscription_active(team_id));

-- "using" picks the rows you may edit; "with check" stops you moving a row
-- into another team or handing it to someone else as you save it.
drop policy if exists "edit own and team maps" on public.maps;
create policy "edit own and team maps"
  on public.maps for update
  using (is_team_member(team_id)
         and (scope = 'team' or owner_id = auth.uid())
         and team_subscription_active(team_id))
  with check (is_team_member(team_id)
              and (scope = 'team' or owner_id = auth.uid()));

-- Anyone may delete their own private map. Only the team owner may delete a
-- shared one, so a single member cannot wipe the team's network map.
drop policy if exists "delete own maps, owner deletes shared" on public.maps;
create policy "delete own maps, owner deletes shared"
  on public.maps for delete
  using (is_team_member(team_id)
         and ((scope = 'personal' and owner_id = auth.uid())
              or (scope = 'team' and is_team_owner(team_id))));

-- ──────────────────────────────────────────────────────────────────────────
-- 5. Image storage
-- ──────────────────────────────────────────────────────────────────────────
-- Images are downscaled on upload but still sit inside the map JSON. Moving
-- them here keeps rows small. Path convention: <team-id>/<filename>, so a
-- shared map's images are readable by the whole team.

insert into storage.buckets (id, name, public)
values ('map-images', 'map-images', false)
on conflict (id) do nothing;

drop policy if exists "team reads its images" on storage.objects;
create policy "team reads its images"
  on storage.objects for select
  using (bucket_id = 'map-images'
         and is_team_member(((storage.foldername(name))[1])::uuid));

drop policy if exists "team uploads images" on storage.objects;
create policy "team uploads images"
  on storage.objects for insert
  with check (bucket_id = 'map-images'
              and is_team_member(((storage.foldername(name))[1])::uuid));

drop policy if exists "team deletes its images" on storage.objects;
create policy "team deletes its images"
  on storage.objects for delete
  using (bucket_id = 'map-images'
         and is_team_member(((storage.foldername(name))[1])::uuid));

-- ──────────────────────────────────────────────────────────────────────────
-- 6. Selling a team — what you run when an invoice is paid
-- ──────────────────────────────────────────────────────────────────────────
-- 1. Create the users in Authentication → Users (or send invite links).
-- 2. Then, replacing the values:
--
--   insert into public.teams (name, seats, subscription_ends_at)
--   values ('Doncaster — Public Health', 5, now() + interval '12 months')
--   returning id;
--
--   insert into public.team_members (team_id, user_id, role) values
--     ('<team-id>', '<user-id>', 'owner');
--
-- Renewal is one update:
--   update public.teams
--      set subscription_ends_at = subscription_ends_at + interval '12 months'
--    where id = '<team-id>';

-- ──────────────────────────────────────────────────────────────────────────
-- 7. Verify
-- ──────────────────────────────────────────────────────────────────────────
-- select tablename, rowsecurity from pg_tables
--   where schemaname = 'public' and tablename in ('teams','team_members','maps');
-- select tablename, policyname, cmd from pg_policies
--   where schemaname = 'public' order by tablename, cmd;
