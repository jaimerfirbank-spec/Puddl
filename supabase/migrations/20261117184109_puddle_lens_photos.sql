-- Lens photos are private to the signed-in uploader, including within a team.
-- Apply only after the existing team schema; no production application is automatic.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('puddle-lens','puddle-lens',false,2900000,array['image/jpeg'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy "lens owner reads photos" on storage.objects for select to authenticated
using(bucket_id='puddle-lens' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "lens member uploads photos" on storage.objects for insert to authenticated
with check(bucket_id='puddle-lens' and (storage.foldername(name))[1]=(select auth.uid())::text
 and array_length(storage.foldername(name),1)=1
 and exists(select 1 from public.team_members m where m.user_id=(select auth.uid()) and public.team_subscription_active(m.team_id)));
create policy "lens owner deletes photos" on storage.objects for delete to authenticated
using(bucket_id='puddle-lens' and (storage.foldername(name))[1]=(select auth.uid())::text);
-- No UPDATE: retries cannot overwrite a different photo. No public access.
commit;
