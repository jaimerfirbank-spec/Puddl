-- Who last saved a map. Shown as "last saved by ..." on shared maps and used to say who got in first when two people clash.
-- Apply separately, after a backup and a check on a staging copy. Needs the earlier migrations applied first.
-- Maps that already exist show no name until their next save.
begin;

alter table public.maps add column if not exists updated_by uuid references auth.users(id) on delete set null;

-- The database fills this in from the signed-in account. The app cannot choose it, so nobody can sign a save as someone else.
-- Changes made by hand in the SQL editor have no signed-in account and leave it alone.
create or replace function public.set_updated_by()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null then new.updated_by := auth.uid(); end if;
  return new;
end;
$$;

drop trigger if exists maps_set_updated_by on public.maps;
create trigger maps_set_updated_by before insert or update on public.maps
  for each row execute function public.set_updated_by();

commit;
