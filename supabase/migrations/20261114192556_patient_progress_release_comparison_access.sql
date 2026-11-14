-- A linked patient can read a comparison released from Progress, and the
-- before and after photographs of that comparison. Staff access stays in place.
-- Shared comparisons and released sessions stay in place.

create or replace function private.patient_can_view_photo(target_photo uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_patient_self(private.photo_patient_id(target_photo))
    and (
      exists (
        select 1
        from public.photos as photo
        join public.photo_sessions as session on session.id = photo.session_id
        where photo.id = target_photo
          and session.released_to_patient
      )
      or exists (
        select 1
        from public.comparisons as comparison
        where comparison.revoked_at is null
          and comparison.shared_with_patient
          and (
            comparison.before_photo_id = target_photo
            or comparison.after_photo_id = target_photo
          )
      )
      or exists (
        select 1
        from public.comparisons as comparison
        join public.progress_releases as release
          on release.comparison_id = comparison.id
        where comparison.revoked_at is null
          and release.revoked_at is null
          and release.patient_id = private.treatment_patient_id(comparison.treatment_id)
          and private.photo_patient_id(target_photo) = release.patient_id
          and private.is_patient_self(release.patient_id)
          and (
            comparison.before_photo_id = target_photo
            or comparison.after_photo_id = target_photo
          )
      )
    );
$$;

drop policy comparisons_select on public.comparisons;

create policy comparisons_select
  on public.comparisons
  for select
  to authenticated
  using (
    (select private.can_staff_patient(private.treatment_patient_id(treatment_id)))
    or (
      revoked_at is null
      and (select private.is_patient_self(private.treatment_patient_id(treatment_id)))
      and (
        shared_with_patient
        or exists (
          select 1
          from public.progress_releases as release
          where release.comparison_id = comparisons.id
            and release.revoked_at is null
            and release.patient_id = private.treatment_patient_id(comparisons.treatment_id)
            and (select private.is_patient_self(release.patient_id))
        )
      )
    )
  );
