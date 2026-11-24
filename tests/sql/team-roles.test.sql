-- View-only members, role changes and removing people. Needs the same setup as shared-maps.test.sql plus 20261125_team_roles.sql.
\set ON_ERROR_STOP on
begin;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
revoke delete on public.team_members from authenticated;
-- Ann owns team 1; Ben is a member; Dee is a viewer; Eve is a member who will be removed; Cat owns team 2
create temp table who (name text primary key, id uuid);
insert into auth.users (id,email) values
 ('00000000-0000-0000-0000-00000000000a','ann@x'),('00000000-0000-0000-0000-00000000000b','ben@x'),
 ('00000000-0000-0000-0000-00000000000c','cat@x'),('00000000-0000-0000-0000-00000000000d','dee@x'),
 ('00000000-0000-0000-0000-00000000000e','eve@x');
insert into who select split_part(email,'@',1), id from auth.users;
insert into public.teams (id,name,seats,subscription_ends_at) values
 ('11111111-1111-1111-1111-111111111111','Team 1',5,now()+interval '1 year'),
 ('22222222-2222-2222-2222-222222222222','Team 2',5,now()+interval '1 year');
insert into public.team_members values
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','owner'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000b','member'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000d','viewer'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000e','member'),
 ('22222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-00000000000c','owner');
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
create or replace function pg_temp.visible(mid uuid) returns boolean language sql as $$ select exists(select 1 from public.maps where id=mid) $$;

do $$
declare t1 constant uuid := '11111111-1111-1111-1111-111111111111'; m1 uuid; m2 uuid; m3 uuid; n int;
begin
  perform pg_temp.as_user('ben');
  insert into public.maps (team_id,owner_id,title,data) values (t1,'00000000-0000-0000-0000-00000000000b','Ben shared','{"v":1}') returning id into m1;
  perform public.share_map(m1);

  -- a viewer can read but not change, make or share anything
  perform pg_temp.as_user('dee');
  perform pg_temp.check(pg_temp.visible(m1),'a viewer can see a shared map');
  update public.maps set data='{"v":2}' where id=m1;
  reset role; perform pg_temp.check((select data->>'v' from public.maps where id=m1)='1','a viewer''s edit changes nothing');
  perform pg_temp.as_user('dee');
  perform pg_temp.check(pg_temp.refused('insert into public.maps (team_id,owner_id,title,data) values ('''||t1||''',''00000000-0000-0000-0000-00000000000d'',''Dee map'',''{}'')'),'a viewer cannot make a map');
  perform pg_temp.check(pg_temp.refused('select public.unshare_map('''||m1||''')'),'a viewer cannot make a shared map private');
  perform pg_temp.check(not exists(select 1 from public.team_roster(t1) where false),'roster call works for a viewer');
  perform pg_temp.check((select count(*) from public.team_roster(t1))=4,'a viewer sees the whole team list');

  -- a member still edits as before
  perform pg_temp.as_user('ben'); update public.maps set data='{"v":3}' where id=m1;
  reset role; perform pg_temp.check((select data->>'v' from public.maps where id=m1)='3','a member can still edit a shared map');

  -- roster is for the team only
  perform pg_temp.as_user('cat');
  perform pg_temp.check(pg_temp.refused('select * from public.team_roster('''||t1||''')'),'someone from another team cannot see the team list');

  -- only the owner changes roles
  perform pg_temp.as_user('ben');
  perform pg_temp.check(pg_temp.refused('select public.set_member_role('''||t1||''',''00000000-0000-0000-0000-00000000000e'',''viewer'')'),'a member cannot change roles');
  perform pg_temp.as_user('dee');
  perform pg_temp.check(pg_temp.refused('select public.set_member_role('''||t1||''',''00000000-0000-0000-0000-00000000000d'',''member'')'),'a viewer cannot promote themselves');
  perform pg_temp.as_user('ann');
  perform public.set_member_role(t1,'00000000-0000-0000-0000-00000000000d','member');
  perform pg_temp.as_user('dee'); update public.maps set data='{"v":4}' where id=m1;
  reset role; perform pg_temp.check((select data->>'v' from public.maps where id=m1)='4','once promoted, Dee can edit');
  perform pg_temp.as_user('ann'); perform public.set_member_role(t1,'00000000-0000-0000-0000-00000000000d','viewer');
  perform pg_temp.check(pg_temp.refused('select public.set_member_role('''||t1||''',''00000000-0000-0000-0000-00000000000a'',''viewer'')'),'the owner cannot be made a viewer');
  perform pg_temp.check(pg_temp.refused('select public.set_member_role('''||t1||''',''00000000-0000-0000-0000-00000000000b'',''owner'')'),'nobody can be made owner through the app');
  perform pg_temp.as_user('cat');
  perform pg_temp.check(pg_temp.refused('select public.set_member_role('''||t1||''',''00000000-0000-0000-0000-00000000000b'',''viewer'')'),'another team''s owner cannot change our roles');

  -- adding people through the table: owner only, never as owner
  perform pg_temp.as_user('ann');
  perform pg_temp.check(pg_temp.refused('insert into public.team_members values ('''||t1||''',''00000000-0000-0000-0000-00000000000c'',''owner'')'),'the app cannot add a second owner');
  perform pg_temp.as_user('ben');
  perform pg_temp.check(pg_temp.refused('insert into public.team_members values ('''||t1||''',''00000000-0000-0000-0000-00000000000c'',''member'')'),'a member cannot add people');

  -- removing people
  perform pg_temp.as_user('ben');
  perform pg_temp.check(pg_temp.refused('select public.remove_team_member('''||t1||''',''00000000-0000-0000-0000-00000000000e'')'),'a member cannot remove people');
  perform pg_temp.check(pg_temp.refused('delete from public.team_members where user_id=''00000000-0000-0000-0000-00000000000e'''),'nobody can delete roster rows directly');
  -- Eve makes a private map and a shared map, then leaves
  perform pg_temp.as_user('eve');
  insert into public.maps (team_id,owner_id,title,data) values (t1,'00000000-0000-0000-0000-00000000000e','Eve private','{}') returning id into m2;
  insert into public.maps (team_id,owner_id,title,data) values (t1,'00000000-0000-0000-0000-00000000000e','Eve shared','{}') returning id into m3;
  perform public.share_map(m3);
  perform pg_temp.as_user('ann');
  perform pg_temp.check(pg_temp.refused('select public.remove_team_member('''||t1||''',''00000000-0000-0000-0000-00000000000a'')'),'the owner cannot remove themselves');
  perform pg_temp.check(not pg_temp.visible(m2),'Ann cannot see Eve''s private map before');
  perform public.remove_team_member(t1,'00000000-0000-0000-0000-00000000000e');
  perform pg_temp.check((select count(*) from public.team_roster(t1))=3,'the team list is one shorter');
  perform pg_temp.check(pg_temp.visible(m3),'a shared map Eve made stays with the team');
  reset role; perform pg_temp.check((select owner_id from public.maps where id=m3) is null,'the shared map no longer names Eve as its maker');
  perform pg_temp.check(exists(select 1 from public.maps where id=m2),'Eve''s private map is kept, not deleted');
  perform pg_temp.as_user('ann'); perform pg_temp.check(not pg_temp.visible(m2),'nobody on the team can see Eve''s private map');
  perform pg_temp.as_user('eve');
  perform pg_temp.check(not pg_temp.visible(m3) and not pg_temp.visible(m2),'Eve sees nothing of the team once removed');
  perform pg_temp.check(pg_temp.refused('select public.share_map('''||m2||''')'),'Eve cannot share after being removed');
  perform pg_temp.as_user('cat');
  perform pg_temp.check(pg_temp.refused('select public.remove_team_member('''||t1||''',''00000000-0000-0000-0000-00000000000b'')'),'another team''s owner cannot remove our people');
  -- the freed seat can be used again
  reset role; insert into public.team_members values (t1,'00000000-0000-0000-0000-00000000000e','member');
  perform pg_temp.as_user('eve'); perform pg_temp.check(pg_temp.visible(m2),'if Eve is added back, her private map returns');
  raise notice 'ALL SQL CHECKS PASSED';
end $$;
rollback;
