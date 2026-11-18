-- Apply on staging first. This is required by the protected photo API.
begin;
create table if not exists public.photo_read_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now()
);
create index if not exists photo_read_requests_user_time on public.photo_read_requests(user_id,requested_at);
alter table public.photo_read_requests enable row level security;
revoke all on public.photo_read_requests from anon, authenticated;
create or replace function public.consume_photo_read()
returns boolean language plpgsql security definer set search_path = public as $$
declare caller uuid := auth.uid(); used int;
begin
  if caller is null then return false; end if;
  -- Require a current paid/invited team membership, using the same subscription
  -- rule as creating maps. Anonymous and expired accounts cannot run paid reads.
  if not exists(select 1 from public.team_members m where m.user_id=caller
                and public.team_subscription_active(m.team_id)) then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended('photo:'||caller::text,0));
  delete from public.photo_read_requests where user_id=caller and requested_at<now()-interval '1 hour';
  select count(*) into used from public.photo_read_requests where user_id=caller;
  if used>=10 then return false; end if;
  insert into public.photo_read_requests(user_id) values(caller);
  return true;
end;
$$;
revoke all on function public.consume_photo_read() from public, anon;
grant execute on function public.consume_photo_read() to authenticated;
commit;
