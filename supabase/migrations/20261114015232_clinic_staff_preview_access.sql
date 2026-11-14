-- Staff can preview the web copies of clinical photographs they already access.
-- Uploads and publication remain restricted to administrators.
create policy showcase_storage_staff_read on storage.objects for select to authenticated using(bucket_id='clinic-showcase' and exists(select 1 from public.clinic_profiles p where p.organization_id::text=split_part(name,'/',1) and (select private.is_org_staff(p.organization_id))));
