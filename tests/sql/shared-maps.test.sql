-- Who can see, edit, share and delete what, tested with real Postgres rules and three people in two teams.
-- Needs: 00-supabase-stub.sql, supabase/schema.sql, 20261117_reliable_map_limits.sql, 20261124_share_maps.sql applied.
-- Run: psql -v ON_ERROR_STOP=1 -f tests/sql/shared-maps.test.sql   (prints one line per check; any failure stops it)
\set ON_ERROR_STOP on
begin;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
-- people: Ann owns team 1, Ben is a member of team 1, Cat belongs to team 2
create temp table who (name text primary key, id uuid);
insert into auth.users (id,email) values ('00000000-0000-0000-0000-00000000000a','ann@x'),('00000000-0000-0000-0000-00000000000b','ben@x'),('00000000-0000-0000-0000-00000000000c','cat@x');
insert into who values ('ann','00000000-0000-0000-0000-00000000000a'),('ben','00000000-0000-0000-0000-00000000000b'),('cat','00000000-0000-0000-0000-00000000000c');
insert into public.teams (id,name,seats,subscription_ends_at) values ('11111111-1111-1111-1111-111111111111','Team 1',5,now()+interval '1 year'),('22222222-2222-2222-2222-222222222222','Team 2',5,now()+interval '1 year');
insert into public.team_members values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','owner'),('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000b','member'),('22222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-00000000000c','owner');
grant select on who to authenticated;

create or replace function pg_temp.as_user(p text) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub',(select id::text from who where name=p),true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  execute 'set local role authenticated';
end $$;
create or replace function pg_temp.pass(msg text) returns void language plpgsql as $$ begin raise notice 'PASS  %',msg; end $$;
create or replace function pg_temp.check(cond boolean,msg text) returns void language plpgsql as $$ begin if cond is not true then raise exception 'FAIL  %',msg; end if; perform pg_temp.pass(msg); end $$;
-- run a statement as the current user and say whether it was refused
create or replace function pg_temp.refused(stmt text) returns boolean language plpgsql as $$ begin execute stmt; return false; exception when others then return true; end $$;
create or replace function pg_temp.visible(mid uuid) returns boolean language sql as $$ select exists(select 1 from public.maps where id=mid) $$;

do $$
declare m1 uuid; m2 uuid; m3 uuid; n int;
begin
  -- Ann makes a private map
  perform pg_temp.as_user('ann');
  insert into public.maps (team_id,owner_id,title,data) values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','Ann private','{"v":1}') returning id into m1;
  perform pg_temp.check(pg_temp.visible(m1),'Ann sees her own private map');
  perform pg_temp.as_user('ben'); perform pg_temp.check(not pg_temp.visible(m1),'Ben cannot see Ann''s private map');
  perform pg_temp.check(pg_temp.refused('select public.share_map('''||m1||''')'),'Ben cannot share Ann''s map');
  perform pg_temp.as_user('ann');
  perform pg_temp.check(pg_temp.refused('update public.maps set scope=''team'' where id='''||m1||''''),'Ann cannot flip her own map to shared by editing the row directly');
  perform pg_temp.check(pg_temp.refused('update public.maps set team_id=''22222222-2222-2222-2222-222222222222'' where id='''||m1||''''),'Ann cannot move her map to another team');
  perform pg_temp.check(pg_temp.refused('update public.maps set owner_id=''00000000-0000-0000-0000-00000000000b'' where id='''||m1||''''),'Ann cannot hand her map to Ben by editing the row');
  -- sharing
  perform public.share_map(m1);
  reset role; perform pg_temp.check((select scope from public.maps where id=m1)='team','share_map makes it a team map');
  perform pg_temp.as_user('ben'); perform pg_temp.check(pg_temp.visible(m1),'Ben now sees the shared map');
  update public.maps set data='{"v":2}' where id=m1;
  perform pg_temp.check((select data->>'v' from public.maps where id=m1)='2','Ben can edit the shared map');
  perform pg_temp.check(pg_temp.refused('update public.maps set owner_id=''00000000-0000-0000-0000-00000000000b'' where id='''||m1||''''),'Ben cannot take ownership of the shared map');
  delete from public.maps where id=m1; reset role; perform pg_temp.check(exists(select 1 from public.maps where id=m1),'Ben cannot delete the shared map (the row is still there)'); perform pg_temp.as_user('ben');
  perform pg_temp.check(pg_temp.refused('select public.unshare_map('''||m1||''')'),'Ben cannot make Ann''s shared map private');
  perform pg_temp.as_user('cat'); perform pg_temp.check(not pg_temp.visible(m1),'Cat (another team) cannot see the shared map');
  perform pg_temp.check(pg_temp.refused('select public.share_map('''||m1||''')'),'Cat cannot share a map from another team');
  update public.maps set data='{"v":9}' where id=m1;
  reset role; perform pg_temp.check((select data->>'v' from public.maps where id=m1)='2','Cat''s attempted edit changed nothing');
  -- Ben shares his own; the team owner can pull it back; Ben cannot be locked out of deleting his private ones
  perform pg_temp.as_user('ben');
  insert into public.maps (team_id,owner_id,title,data) values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000b','Ben private','{}') returning id into m2;
  perform public.share_map(m2);
  perform pg_temp.as_user('ann'); perform pg_temp.check(pg_temp.visible(m2),'Ann sees Ben''s shared map');
  perform public.unshare_map(m2);
  reset role; perform pg_temp.check((select scope||owner_id::text from public.maps where id=m2)='personal00000000-0000-0000-0000-00000000000b','the team owner can make Ben''s map private again, and it stays Ben''s');
  perform pg_temp.as_user('ann'); perform pg_temp.check(not pg_temp.visible(m2),'Ann can no longer see it');
  -- the maker unshares; the team owner deletes a shared map
  perform pg_temp.as_user('ann'); perform public.unshare_map(m1); perform public.share_map(m1);
  perform pg_temp.as_user('ben'); perform pg_temp.check(pg_temp.visible(m1),'shared again');
  perform pg_temp.as_user('ann'); delete from public.maps where id=m1; reset role; perform pg_temp.check(not exists(select 1 from public.maps where id=m1),'the team owner can delete a shared map');
  -- a map whose maker has left goes to the team owner when made private, not into the void
  reset role; insert into public.maps (team_id,owner_id,title,scope,data) values ('11111111-1111-1111-1111-111111111111',null,'Orphan','team','{}') returning id into m3;
  perform pg_temp.as_user('ben'); perform pg_temp.check(pg_temp.visible(m3),'an orphaned shared map is still visible to members');
  perform pg_temp.check(pg_temp.refused('select public.unshare_map('''||m3||''')'),'a member cannot make an orphaned map private');
  perform pg_temp.as_user('ann'); perform public.unshare_map(m3);
  reset role; perform pg_temp.check((select owner_id from public.maps where id=m3)='00000000-0000-0000-0000-00000000000a','an orphaned map goes to the team owner');
  -- expired subscription: read yes, share no, edit no
  update public.teams set subscription_ends_at=now()-interval '1 day' where id='11111111-1111-1111-1111-111111111111';
  perform pg_temp.as_user('ann'); perform pg_temp.check(pg_temp.visible(m3),'after expiry Ann can still read her maps');
  perform pg_temp.check(pg_temp.refused('select public.share_map('''||m3||''')'),'after expiry a map cannot be shared');
  reset role; update public.teams set subscription_ends_at=now()+interval '1 year' where id='11111111-1111-1111-1111-111111111111';
  -- the private map limit applies when making a map private again
  update public.teams set maps_per_user=1 where id='11111111-1111-1111-1111-111111111111';
  insert into public.maps (team_id,owner_id,title,scope,data) values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','Shared again','team','{}') returning id into m1;
  perform pg_temp.as_user('ann'); perform pg_temp.check(pg_temp.refused('select public.unshare_map('''||m1||''')'),'making a map private is refused when it would go over the private map limit');
  raise notice 'ALL SQL CHECKS PASSED';
end $$;
rollback;
