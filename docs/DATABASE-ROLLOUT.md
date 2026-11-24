# Putting the five database updates live

Nothing here has been run on the live database. The shared workspace (sharing maps, view-only members, "last saved by",
history) does not work on the live site until this is done. The app copes without it: Share and History say a database update
is needed, and everything else works as before.

Do this only when the owner says go. Do not do it on a day a customer is relying on the site.

## The five updates, in this order

All are in `supabase/migrations/`. Each is one file, runs in one go, and can be run once.

1. `20261117_reliable_map_limits.sql` makes the seat and map limits safe when two people act at once, and stops the app changing who owns a map.
2. `20261124_share_maps.sql` adds Share and Make private.
3. `20261125_team_roles.sql` adds view-only members, the team list, changing roles and removing people.
4. `20261126_edited_by.sql` records who last saved a map.
5. `20261127_map_history.sql` keeps earlier versions of shared maps and lets people go back.

## Before

1. **Take a backup.** On the Basic (free) plan there are no automatic backups, so this is the only safety net. In Supabase, Database, then Backups, or use the command line: `pg_dump` against the connection string in Project Settings. Keep the file somewhere private and out of the repository. Also export the maps you care about from the app (Save a copy).
2. **Check it on a copy first.** Make a second, empty Supabase project. In its SQL editor run `supabase/schema.sql`, then the five files in order. Make two test accounts and a test team (see below). In the app, pointed at that project, try: share a map from one account, open it from the other, edit from both, try to go back a version, try a view-only account. Then try to break it: open a map from an account in no team.
3. **Look at the live team.** Run the first two read-only queries in the team setup notes (kept outside the repository) to see whether the team and owner already exist.

## Running it

In the live project's SQL editor, paste each file in turn and press Run. Stop at the first error and do not carry on. Each file starts a transaction and ends it only if everything worked, so a failed file changes nothing.

## After, to check

Run these in the SQL editor (they only read):

```sql
select proname from pg_proc where proname in
  ('share_map','unshare_map','team_roster','set_member_role','remove_team_member','restore_map_version','can_edit_team');
-- expect 7 rows
select column_name from information_schema.columns where table_name = 'maps' and column_name = 'updated_by';
-- expect 1 row
select tablename, policyname, cmd from pg_policies where schemaname = 'public' order by tablename, policyname;
-- read it through once; map_versions should have a select policy only
```

Then in the live app, with a test account: share a map, make it private, open Team, open History.

## If something goes wrong

The updates add things and replace some rules; they do not delete anyone's maps. If the app misbehaves afterwards, the quickest safe step is to tell people to use Save a copy for anything important and to restore from the backup taken above. Do not try to hand-edit rules in the live project without a backup.

## Adding a colleague, by hand

In the SQL editor, after they have signed up (their account then exists under Authentication). Use `member` for someone who can edit, `viewer` for someone who can only look. The database refuses once the seats are used.

```sql
insert into public.team_members (team_id, user_id, role)
values ('TEAM-ID', 'THEIR-USER-ID', 'member');
```

Changing a role or removing someone later is done by the owner, from the Team button in Your maps.
