-- Capture guidance notes. These rows store scores only.
-- They do not store landmarks, embeddings, or a copy of the photograph.

create table public.organization_capture_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  guidance_enabled boolean not null default true,
  schema_version integer not null default 1,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  constraint organization_capture_settings_schema check (schema_version = 1)
);

create table public.capture_quality_assessments (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photos (id) on delete cascade,
  session_id uuid not null references public.photo_sessions (id) on delete cascade,
  schema_version integer not null,
  status text not null,
  detector text not null,
  detector_version text not null,
  warnings text[] not null default '{}',
  metrics jsonb not null,
  instruction text not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint capture_quality_assessments_schema check (schema_version = 1),
  constraint capture_quality_assessments_status check (status in ('good', 'warning', 'poor', 'unavailable')),
  constraint capture_quality_assessments_detector check (detector in ('face-detector', 'none')),
  constraint capture_quality_assessments_warnings check (
    warnings <@ array[
      'detector_unavailable',
      'face_missing',
      'face_off_center',
      'face_too_small',
      'face_too_large',
      'pose_mismatch',
      'blur',
      'exposure_dark',
      'exposure_bright',
      'unstable',
      'baseline_mismatch'
    ]::text[]
  ),
  constraint capture_quality_assessments_metrics_private check (
    not (metrics ? 'landmarks' or metrics ? 'embedding' or metrics ? 'template' or metrics ? 'pixels')
  ),
  constraint capture_quality_assessments_instruction_length check (char_length(instruction) between 1 and 160)
);

create unique index capture_quality_assessments_photo_id_idx
  on public.capture_quality_assessments (photo_id);

create table public.capture_quality_overrides (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.capture_quality_assessments (id) on delete cascade,
  photo_id uuid not null references public.photos (id) on delete cascade,
  reason text not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint capture_quality_overrides_reason_length check (char_length(reason) between 3 and 500)
);

create index capture_quality_overrides_photo_id_idx
  on public.capture_quality_overrides (photo_id);

alter table public.organization_capture_settings enable row level security;
alter table public.capture_quality_assessments enable row level security;
alter table public.capture_quality_overrides enable row level security;
alter table public.organization_capture_settings force row level security;
alter table public.capture_quality_assessments force row level security;
alter table public.capture_quality_overrides force row level security;

create policy organization_capture_settings_select_staff
  on public.organization_capture_settings
  for select
  to authenticated
  using ((select private.is_org_staff(organization_id)));

create policy organization_capture_settings_insert_admin
  on public.organization_capture_settings
  for insert
  to authenticated
  with check (
    updated_by = (select auth.uid())
    and exists (
      select 1
      from public.organization_members as member
      where member.organization_id = organization_capture_settings.organization_id
        and member.profile_id = (select auth.uid())
        and member.role = 'clinic_admin'
    )
  );

create policy organization_capture_settings_update_admin
  on public.organization_capture_settings
  for update
  to authenticated
  using ((select private.is_org_staff(organization_id)))
  with check (
    updated_by = (select auth.uid())
    and exists (
      select 1
      from public.organization_members as member
      where member.organization_id = organization_capture_settings.organization_id
        and member.profile_id = (select auth.uid())
        and member.role = 'clinic_admin'
    )
  );

create policy capture_quality_assessments_select_staff
  on public.capture_quality_assessments
  for select
  to authenticated
  using ((select private.is_org_staff(private.photo_organization_id(photo_id))));

create policy capture_quality_assessments_insert_staff
  on public.capture_quality_assessments
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and schema_version = 1
    and (select private.is_org_staff(private.photo_organization_id(photo_id)))
    and exists (
      select 1
      from public.photos as photo
      where photo.id = photo_id
        and photo.session_id = session_id
        and photo.upload_status = 'uploaded'
    )
  );

create policy capture_quality_overrides_select_staff
  on public.capture_quality_overrides
  for select
  to authenticated
  using ((select private.is_org_staff(private.photo_organization_id(photo_id))));

create policy capture_quality_overrides_insert_staff
  on public.capture_quality_overrides
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and (select private.is_org_staff(private.photo_organization_id(photo_id)))
    and exists (
      select 1
      from public.capture_quality_assessments as assessment
      where assessment.id = assessment_id
        and assessment.photo_id = photo_id
    )
  );

revoke all on public.organization_capture_settings from public, anon;
revoke all on public.capture_quality_assessments from public, anon;
revoke all on public.capture_quality_overrides from public, anon;
grant select, insert, update on public.organization_capture_settings to authenticated;
grant select, insert on public.capture_quality_assessments to authenticated;
grant select, insert on public.capture_quality_overrides to authenticated;
