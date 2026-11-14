-- Clinic operations for templates, released progress, and follow-up reminders.
-- Historical treatments and original photographs are not changed.

create table public.treatment_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  category text not null,
  body_area text not null,
  protocol_code text not null default 'FACE_STANDARD',
  follow_up_days integer,
  archived_at timestamptz,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint treatment_templates_name_length check (char_length(btrim(name)) between 1 and 120),
  constraint treatment_templates_category_length check (char_length(btrim(category)) between 1 and 80),
  constraint treatment_templates_body_area_length check (char_length(btrim(body_area)) between 1 and 80),
  constraint treatment_templates_follow_up_days check (follow_up_days is null or follow_up_days between 1 and 3650)
);

create index treatment_templates_organization_id_idx
  on public.treatment_templates (organization_id);

create table public.progress_releases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  comparison_id uuid references public.comparisons (id) on delete cascade,
  photo_id uuid references public.photos (id) on delete cascade,
  released_by uuid not null references public.profiles (id),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint progress_releases_one_target check (
    (comparison_id is not null and photo_id is null)
    or (comparison_id is null and photo_id is not null)
  )
);

create index progress_releases_patient_id_idx on public.progress_releases (patient_id);

create table public.follow_up_reminders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  treatment_id uuid not null references public.treatments (id) on delete cascade,
  due_on date not null,
  note text,
  completed_at timestamptz,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint follow_up_reminders_note_length check (note is null or char_length(note) <= 500)
);

create index follow_up_reminders_organization_id_idx
  on public.follow_up_reminders (organization_id, due_on);

alter table public.treatment_templates enable row level security;
alter table public.progress_releases enable row level security;
alter table public.follow_up_reminders enable row level security;
alter table public.treatment_templates force row level security;
alter table public.progress_releases force row level security;
alter table public.follow_up_reminders force row level security;

create policy treatment_templates_select_staff
  on public.treatment_templates
  for select
  to authenticated
  using ((select private.is_org_staff(organization_id)));

create policy treatment_templates_insert_admin
  on public.treatment_templates
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1
      from public.organization_members as member
      where member.organization_id = treatment_templates.organization_id
        and member.profile_id = (select auth.uid())
        and member.role = 'clinic_admin'
    )
  );

create policy treatment_templates_update_admin
  on public.treatment_templates
  for update
  to authenticated
  using ((select private.is_org_staff(organization_id)))
  with check (
    exists (
      select 1
      from public.organization_members as member
      where member.organization_id = treatment_templates.organization_id
        and member.profile_id = (select auth.uid())
        and member.role = 'clinic_admin'
    )
  );

create policy progress_releases_select_authorized
  on public.progress_releases
  for select
  to authenticated
  using (
    (select private.is_org_staff(organization_id))
    or (
      revoked_at is null
      and exists (
        select 1
        from public.patient_accounts as link
        where link.patient_id = progress_releases.patient_id
          and link.profile_id = (select auth.uid())
      )
    )
  );

create policy progress_releases_insert_staff
  on public.progress_releases
  for insert
  to authenticated
  with check (
    released_by = (select auth.uid())
    and (select private.is_org_staff(organization_id))
  );

create policy progress_releases_update_staff
  on public.progress_releases
  for update
  to authenticated
  using ((select private.is_org_staff(organization_id)))
  with check ((select private.is_org_staff(organization_id)));

create policy follow_up_reminders_select_staff
  on public.follow_up_reminders
  for select
  to authenticated
  using ((select private.is_org_staff(organization_id)));

create policy follow_up_reminders_insert_staff
  on public.follow_up_reminders
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and (select private.is_org_staff(organization_id))
  );

create policy follow_up_reminders_update_staff
  on public.follow_up_reminders
  for update
  to authenticated
  using ((select private.is_org_staff(organization_id)))
  with check ((select private.is_org_staff(organization_id)));

revoke all on public.treatment_templates from public, anon;
revoke all on public.progress_releases from public, anon;
revoke all on public.follow_up_reminders from public, anon;
grant select, insert, update on public.treatment_templates to authenticated;
grant select, insert, update on public.progress_releases to authenticated;
grant select, insert, update on public.follow_up_reminders to authenticated;
