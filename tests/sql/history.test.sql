-- History of shared maps: kept automatically (at most every 15 minutes, newest 20), readable by the team, restorable by editors.
\set ON_ERROR_STOP on
begin;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, update, delete on public.map_versions from authenticated;
grant execute on all functions in schema public to authenticated;
create temp table who (name text primary key, id uuid);
insert into auth.users (id,email) values ('00000000-0000-0000-0000-00000000000a','ann@x'),('00000000-0000-0000-0000-00000000000b','ben@x'),('00000000-0000-0000-0000-00000000000c','cat@x'),('00000000-0000-0000-0000-00000000000d','dee@x');
insert into who select split_part(email,'@',1), id from auth.users;
insert into public.teams (id,name,seats,subscription_ends_at) values ('11111111-1111-1111-1111-111111111111','Team 1',5,now()+interval '1 year'),('22222222-2222-2222-2222-222222222222','Team 2',5,now()+interval '1 year');
insert into public.team_members values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','owner'),('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000b','member'),('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000d','viewer'),('22222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-00000000000c','owner');
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
create or replace function pg_temp.refused(stmt text) returns boolean language plpgsql as $$ begin execute stmt; return false; exception when others then return true; end $$;
-- set a map's last-saved time without any triggers (as the database owner)
create or replace function pg_temp.age(mid uuid, mins int) returns void language plpgsql as $$
begin reset role; set local session_replication_role = replica; update public.maps set updated_at = now() - make_interval(mins => mins) where id = mid; set local session_replication_role = origin; end $$;

create or replace function pg_temp.age_versions(mid uuid, mins int) returns void language plpgsql as $$
begin reset role; set local session_replication_role = replica; update public.map_versions set saved_at = now() - make_interval(mins => mins) where map_id = mid; set local session_replication_role = origin; end $$;

do $$
declare t1 constant uuid := '11111111-1111-1111-1111-111111111111'; a constant uuid := '00000000-0000-0000-0000-00000000000a'; b constant uuid := '00000000-0000-0000-0000-00000000000b';
        m uuid; p uuid; v uuid; n int; i int;
begin
  perform pg_temp.as_user('ann');
  insert into public.maps (team_id,owner_id,title,data) values (t1,a,'Private','{"v":1}') returning id into p;
  update public.maps set data='{"v":2}' where id=p;
  reset role; perform pg_temp.check((select count(*) from public.map_versions)=0,'a private map keeps no history');
  perform pg_temp.as_user('ann');
  insert into public.maps (team_id,owner_id,title,data) values (t1,a,'Shared','{"v":1}') returning id into m;
  perform public.share_map(m);
  update public.maps set data='{"v":2}' where id=m;
  reset role; perform pg_temp.check((select count(*) from public.map_versions where map_id=m)=1,'the first change to a shared map keeps the version it replaced');
  perform pg_temp.check((select data->>'v' from public.map_versions where map_id=m)='1','the kept version is the old one');
  perform pg_temp.as_user('ann'); update public.maps set data='{"v":3}' where id=m;
  reset role; perform pg_temp.check((select count(*) from public.map_versions where map_id=m)=1,'a second save straight after keeps nothing more');
  perform pg_temp.as_user('ann'); update public.maps set title='Renamed' where id=m;
  reset role; perform pg_temp.check((select count(*) from public.map_versions where map_id=m)=1,'renaming keeps no version');
  -- twenty minutes later, a colleague saves: the state before it is kept, attributed to who saved it
  perform pg_temp.age(m,20); perform pg_temp.age_versions(m,60);
  perform pg_temp.as_user('ben'); update public.maps set data='{"v":4}' where id=m;
  reset role; perform pg_temp.check((select count(*) from public.map_versions where map_id=m)=2,'a save 20 minutes later keeps another version');
  perform pg_temp.check((select saved_by from public.map_versions where map_id=m order by saved_at desc limit 1)=a,'the version is credited to the person who had saved it');
  -- the team can read it, outsiders and the app cannot write to it
  perform pg_temp.as_user('ben'); perform pg_temp.check((select count(*) from public.map_versions where map_id=m)=2,'a member can read the history');
  perform pg_temp.as_user('dee'); perform pg_temp.check((select count(*) from public.map_versions where map_id=m)=2,'a viewer can read the history');
  perform pg_temp.as_user('cat'); perform pg_temp.check((select count(*) from public.map_versions)=0,'another team sees no history');
  perform pg_temp.as_user('ben');
  perform pg_temp.check(pg_temp.refused('delete from public.map_versions'),'the app cannot delete history');
  perform pg_temp.check(pg_temp.refused('insert into public.map_versions (map_id,team_id,saved_at,title,data) values ('''||m||''','''||t1||''',now(),''x'',''{}'')'),'the app cannot write history');
  -- restore
  reset role; select id into v from public.map_versions where map_id=m order by saved_at asc limit 1;
  perform pg_temp.as_user('dee'); perform pg_temp.check(pg_temp.refused('select public.restore_map_version('''||v||''')'),'a viewer cannot go back to a version');
  perform pg_temp.as_user('cat'); perform pg_temp.check(pg_temp.refused('select public.restore_map_version('''||v||''')'),'another team cannot go back to a version');
  perform pg_temp.as_user('ben'); perform public.restore_map_version(v);
  reset role; perform pg_temp.check((select data->>'v' from public.maps where id=m)='1','a member can go back to the first version');
  perform pg_temp.check((select count(*) from public.map_versions where map_id=m and data->>'v'='4')=1,'going back keeps the version it replaced, so it can be undone');
  perform pg_temp.check((select updated_by from public.maps where id=m)=b,'the map records who went back');
  -- after the map is made private its history is no longer readable
  perform pg_temp.as_user('ann'); perform public.unshare_map(m);
  perform pg_temp.check((select count(*) from public.map_versions where map_id=m)=0,'history cannot be read once the map is private');
  perform public.share_map(m);
  -- cap of 20
  reset role; perform pg_temp.age(m,600);
  delete from public.map_versions where map_id=m;
  insert into public.map_versions (map_id,team_id,saved_at,title,data) select m,t1,now()-interval '1 day'-make_interval(mins=>g),'old','{}' from generate_series(1,30) g;
  perform pg_temp.as_user('ann'); update public.maps set data='{"v":9}' where id=m;
  reset role; perform pg_temp.check((select count(*) from public.map_versions where map_id=m)=20,'only the newest 20 versions are kept');
  perform pg_temp.check(exists(select 1 from public.map_versions where map_id=m and saved_at>now()-interval '11 hours'),'the newest one is among them');
  -- subscription ended: cannot go back
  update public.teams set subscription_ends_at=now()-interval '1 day' where id=t1;
  select id into v from public.map_versions where map_id=m order by saved_at desc limit 1;
  perform pg_temp.as_user('ann'); perform pg_temp.check(pg_temp.refused('select public.restore_map_version('''||v||''')'),'after the subscription ends nobody can go back');
  raise notice 'ALL SQL CHECKS PASSED';
end $$;
rollback;
