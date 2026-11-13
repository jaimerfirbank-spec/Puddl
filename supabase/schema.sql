-- Puddl — server-side map storage
-- Run once in the Supabase SQL Editor. Safe to re-run.
--
-- Today every map lives in the browser's localStorage. That means a cleared
-- browser destroys a customer's work, maps do not follow them between devices,
-- and anyone using that machine can read another account's maps in devtools.
-- This moves maps into Postgres, where access is enforced by the database
-- rather than by the login screen.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. The table
-- ──────────────────────────────────────────────────────────────────────────

create table if not exists public.maps (
  id         uuid primary key default gen_random_uuid(),

  -- Who owns this map. on delete cascade means deleting the account removes
  -- their maps too, which is what GDPR erasure requests will need.
  user_id    uuid not null references auth.users(id) on delete cascade,

  title      text not null default 'Untitled map',

  -- Matches the five choices on Puddl's "What kind of map is this?" screen.
  kind       text not null default 'general'
             check (kind in ('general','network','systems','stakeholder','argument')),

  -- The whole map: nodes, edges, loops, categories, styles. jsonb because the
  -- shape changes as Puddl grows and a rigid schema would fight every release.
  data       jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Listing a user's maps newest-first is the one query the app runs constantly.
create index if not exists maps_user_updated_idx
  on public.maps (user_id, updated_at desc);

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Keep updated_at honest
-- ──────────────────────────────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists maps_touch_updated_at on public.maps;
create trigger maps_touch_updated_at
  before update on public.maps
  for each row execute function public.touch_updated_at();

-- ──────────────────────────────────────────────────────────────────────────
-- 3. Row Level Security — the part that actually enforces privacy
-- ──────────────────────────────────────────────────────────────────────────
-- Without this, the anon key in Puddl's page source lets anyone read every
-- row. With it, Postgres silently filters every query to the signed-in user,
-- so a bug in the app cannot leak another customer's maps.

alter table public.maps enable row level security;

drop policy if exists "owner selects own maps" on public.maps;
create policy "owner selects own maps"
  on public.maps for select
  using (auth.uid() = user_id);

drop policy if exists "owner inserts own maps" on public.maps;
create policy "owner inserts own maps"
  on public.maps for insert
  with check (auth.uid() = user_id);

-- update needs BOTH clauses. "using" decides which rows you may touch;
-- "with check" stops you handing a row to somebody else by rewriting user_id.
drop policy if exists "owner updates own maps" on public.maps;
create policy "owner updates own maps"
  on public.maps for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "owner deletes own maps" on public.maps;
create policy "owner deletes own maps"
  on public.maps for delete
  using (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────────────────
-- 4. Image storage
-- ──────────────────────────────────────────────────────────────────────────
-- Images are downscaled on upload but still live inside the map JSON. Moving
-- them to Storage keeps rows small and lets the browser cache them.
-- Convention: every object is stored under <user-id>/<filename>, which is what
-- the policies below check.

insert into storage.buckets (id, name, public)
values ('map-images', 'map-images', false)
on conflict (id) do nothing;

drop policy if exists "owner reads own images" on storage.objects;
create policy "owner reads own images"
  on storage.objects for select
  using (bucket_id = 'map-images' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "owner uploads own images" on storage.objects;
create policy "owner uploads own images"
  on storage.objects for insert
  with check (bucket_id = 'map-images' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "owner deletes own images" on storage.objects;
create policy "owner deletes own images"
  on storage.objects for delete
  using (bucket_id = 'map-images' and auth.uid()::text = (storage.foldername(name))[1]);

-- ──────────────────────────────────────────────────────────────────────────
-- 5. Verify
-- ──────────────────────────────────────────────────────────────────────────
-- Run these after the above. Expect rowsecurity = true, and four policies.

-- select tablename, rowsecurity from pg_tables
--   where schemaname = 'public' and tablename = 'maps';

-- select policyname, cmd from pg_policies
--   where schemaname = 'public' and tablename = 'maps' order by cmd;
