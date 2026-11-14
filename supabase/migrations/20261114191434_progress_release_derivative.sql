-- Edited-photograph releases point at photo_derivatives.
-- Original photographs stay on photos and are not released by this column.

alter table public.progress_releases
  add column derivative_id uuid references public.photo_derivatives (id) on delete cascade;

alter table public.progress_releases
  drop constraint progress_releases_one_target;

alter table public.progress_releases
  add constraint progress_releases_one_target check (
    (
      comparison_id is not null
      and photo_id is null
      and derivative_id is null
    )
    or (
      comparison_id is null
      and photo_id is not null
      and derivative_id is null
    )
    or (
      comparison_id is null
      and photo_id is null
      and derivative_id is not null
    )
  );

create index progress_releases_derivative_id_idx
  on public.progress_releases (derivative_id)
  where revoked_at is null and derivative_id is not null;

create or replace function private.patient_can_view_derivative_path(target_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.photo_derivatives as derivative
    join public.progress_releases as release
      on release.derivative_id = derivative.id
    where derivative.storage_path = target_path
      and release.revoked_at is null
      and release.photo_id is null
      and release.comparison_id is null
      and derivative.storage_path ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}\.(jpg|jpeg|png)$'
      and (select private.photo_patient_id(derivative.photo_id)) = release.patient_id
      and (select private.is_patient_self(release.patient_id))
  );
$$;

revoke all on function private.patient_can_view_derivative_path(text) from public, anon;
grant execute on function private.patient_can_view_derivative_path(text) to authenticated;

create policy photo_derivatives_patient_released_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'photo-derivatives'
    and (select private.patient_can_view_derivative_path(name))
  );

create or replace function private.patient_released_edits()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'treatmentId', edit.treatment_id,
          'id', edit.id,
          'storagePath', edit.storage_path,
          'angleName', edit.angle_name
        )
        order by edit.created_at desc
      )
      from (
        select distinct on (derivative.id)
          session.treatment_id,
          derivative.id,
          derivative.storage_path,
          coalesce(nullif(btrim(angle.name), ''), 'Photograph') as angle_name,
          release.created_at
        from public.progress_releases as release
        join public.photo_derivatives as derivative
          on derivative.id = release.derivative_id
        join public.photos as photo
          on photo.id = derivative.photo_id
        join public.photo_sessions as session
          on session.id = photo.session_id
        left join public.photography_angles as angle
          on angle.id = photo.angle_id
        where release.revoked_at is null
          and release.photo_id is null
          and release.comparison_id is null
          and derivative.storage_path ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}\.(jpg|jpeg|png)$'
          and (select private.photo_patient_id(derivative.photo_id)) = release.patient_id
          and (select private.treatment_patient_id(session.treatment_id)) = release.patient_id
          and (select private.is_patient_self(release.patient_id))
        order by derivative.id, release.created_at desc
      ) as edit
    ),
    '[]'::jsonb
  );
$$;

revoke all on function private.patient_released_edits() from public, anon;
grant execute on function private.patient_released_edits() to authenticated;

create or replace function public.patient_released_edits()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.patient_released_edits();
$$;

revoke all on function public.patient_released_edits() from public, anon;
grant execute on function public.patient_released_edits() to authenticated;
