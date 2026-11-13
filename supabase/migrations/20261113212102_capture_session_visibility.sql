-- Insert ... returning must be able to see the new session and photograph.
-- Looking those rows up by their new id fails inside the same statement.
-- Staff visibility uses the treatment or session that already exists.
-- Files that never became an uploaded original can be removed. Uploaded originals stay.

drop policy sessions_select on public.photo_sessions;

create policy sessions_select
  on public.photo_sessions
  for select
  to authenticated
  using (
    (select private.can_staff_patient(private.treatment_patient_id(treatment_id)))
    or (select private.is_patient_self(private.treatment_patient_id(treatment_id)))
  );

drop policy photos_select on public.photos;

create policy photos_select
  on public.photos
  for select
  to authenticated
  using (
    (select private.can_staff_patient(private.session_patient_id(session_id)))
    or (select private.patient_can_view_photo(id))
  );

create policy clinical_photos_staff_delete_orphan
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'clinical-photos'
    and (select private.is_org_staff((storage.foldername(name))[1]::uuid))
    and not exists (
      select 1
      from public.photos
      where photos.storage_path = objects.name
        and photos.upload_status = 'uploaded'
    )
  );
