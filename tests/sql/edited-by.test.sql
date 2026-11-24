-- "Last saved by": filled in by the database from the signed-in account, and impossible to forge.
\set ON_ERROR_STOP on
begin;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
create temp table who (name text primary key, id uuid);
insert into auth.users (id,email) values ('00000000-0000-0000-0000-00000000000a','ann@x'),('00000000-0000-0000-0000-00000000000b','ben@x');
insert into who select split_part(email,'@',1), id from auth.users;
insert into public.teams (id,name,seats,subscription_ends_at) values ('11111111-1111-1111-1111-111111111111','Team 1',5,now()+interval '1 year');
insert into public.team_members values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','owner'),('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000b','member');
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
do $$
declare t1 constant uuid := '11111111-1111-1111-1111-111111111111'; a constant uuid := '00000000-0000-0000-0000-00000000000a'; b constant uuid := '00000000-0000-0000-0000-00000000000b'; m uuid;
begin
  perform pg_temp.as_user('ann');
  insert into public.maps (team_id,owner_id,title,data) values (t1,a,'Shared','{}') returning id into m;
  perform pg_temp.check((select updated_by from public.maps where id=m)=a,'a new map records who made it');
  perform public.share_map(m);
  perform pg_temp.as_user('ben');
  update public.maps set data='{"v":2}' where id=m;
  perform pg_temp.check((select updated_by from public.maps where id=m)=b,'Ben''s save records Ben');
  update public.maps set data='{"v":3}', updated_by=a where id=m;
  perform pg_temp.check((select updated_by from public.maps where id=m)=b,'a save cannot sign itself as someone else');
  reset role;
  update public.maps set title='Renamed by hand' where id=m;
  perform pg_temp.check((select updated_by from public.maps where id=m)=b,'a change made by hand in the SQL editor leaves the name alone');
  perform set_config('request.jwt.claim.sub','',true);
  delete from auth.users where id=b;
  perform pg_temp.check((select updated_by from public.maps where id=m) is null,'if the person is deleted the name is cleared, the map stays');
  raise notice 'ALL SQL CHECKS PASSED';
end $$;
rollback;
