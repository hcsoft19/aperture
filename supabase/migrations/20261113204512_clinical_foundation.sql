-- Clinical foundation: organizations, records, protocol versions, and private storage.
-- Authorization lives in RLS and in private security-definer functions.
-- Roles are never read from user_metadata.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.organization_role as enum ('clinic_admin', 'professional');

create type public.treatment_status as enum ('planned', 'active', 'completed', 'cancelled');

create type public.session_type as enum ('baseline', 'follow_up');

create type public.session_status as enum ('draft', 'completed', 'cancelled');

create type public.photo_source as enum ('camera', 'gallery');

create type public.upload_status as enum ('pending', 'uploaded', 'failed');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.log_audit(
  target_org uuid,
  action text,
  entity_type text,
  entity_id uuid,
  metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_events (
    organization_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    target_org,
    (select auth.uid()),
    action,
    entity_type,
    entity_id,
    coalesce(metadata, '{}'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Identity and clinics
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_length check (
    full_name is null or char_length(btrim(full_name)) between 1 and 120
  )
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_name_length check (char_length(btrim(name)) between 2 and 120)
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role public.organization_role not null,
  created_at timestamptz not null default now(),
  constraint organization_members_unique unique (organization_id, profile_id)
);

create index organization_members_profile_id_idx
  on public.organization_members (profile_id);

create index organization_members_org_role_idx
  on public.organization_members (organization_id, role);

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function private.handle_new_user();

create or replace function private.is_org_staff(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members as member
    where member.organization_id = target_org
      and member.profile_id = (select auth.uid())
      and member.role in ('clinic_admin', 'professional')
  );
$$;

create or replace function private.is_org_admin(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members as member
    where member.organization_id = target_org
      and member.profile_id = (select auth.uid())
      and member.role = 'clinic_admin'
  );
$$;

create or replace function private.create_organization(org_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  cleaned text;
  new_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;

  cleaned := btrim(org_name);

  if cleaned is null or char_length(cleaned) < 2 or char_length(cleaned) > 120 then
    raise exception 'Organization name must be between 2 and 120 characters';
  end if;

  insert into public.organizations (name, created_by)
  values (cleaned, (select auth.uid()))
  returning id into new_id;

  insert into public.organization_members (organization_id, profile_id, role)
  values (new_id, (select auth.uid()), 'clinic_admin');

  return new_id;
end;
$$;

create or replace function private.add_organization_member(
  target_org uuid,
  member_email text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_id uuid;
begin
  if not private.is_org_admin(target_org) then
    raise exception 'Only a clinic administrator can add members';
  end if;

  select users.id
  into member_id
  from auth.users as users
  where lower(users.email) = lower(btrim(member_email));

  if member_id is null then
    raise exception 'No account exists for that email';
  end if;

  if exists (
    select 1
    from public.organization_members as member
    where member.organization_id = target_org
      and member.profile_id = member_id
  ) then
    raise exception 'That person is already a member of this clinic';
  end if;

  insert into public.organization_members (organization_id, profile_id, role)
  values (target_org, member_id, 'professional');
end;
$$;

create or replace function private.assert_remaining_admin(
  target_org uuid,
  target_profile uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.organization_members as member
    where member.organization_id = target_org
      and member.profile_id = target_profile
      and member.role = 'clinic_admin'
  ) and not exists (
    select 1
    from public.organization_members as member
    where member.organization_id = target_org
      and member.role = 'clinic_admin'
      and member.profile_id <> target_profile
  ) then
    raise exception 'The clinic needs at least one administrator';
  end if;
end;
$$;

create or replace function private.set_organization_member_role(
  target_org uuid,
  target_profile uuid,
  next_role public.organization_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_org_admin(target_org) then
    raise exception 'Only a clinic administrator can change roles';
  end if;

  if next_role <> 'clinic_admin' then
    perform private.assert_remaining_admin(target_org, target_profile);
  end if;

  update public.organization_members
  set role = next_role
  where organization_id = target_org
    and profile_id = target_profile;

  if not found then
    raise exception 'That person is not a member of this clinic';
  end if;
end;
$$;

create or replace function private.remove_organization_member(
  target_org uuid,
  target_profile uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_org_admin(target_org) then
    raise exception 'Only a clinic administrator can remove members';
  end if;

  perform private.assert_remaining_admin(target_org, target_profile);

  delete from public.organization_members
  where organization_id = target_org
    and profile_id = target_profile;

  if not found then
    raise exception 'That person is not a member of this clinic';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Clinical records
-- ---------------------------------------------------------------------------

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  date_of_birth date,
  contact_email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patients_first_name_length check (char_length(btrim(first_name)) between 1 and 80),
  constraint patients_last_name_length check (char_length(btrim(last_name)) between 1 and 80),
  constraint patients_contact_email_length check (
    contact_email is null or char_length(contact_email) <= 320
  ),
  constraint patients_phone_length check (phone is null or char_length(phone) <= 40)
);

create index patients_organization_id_idx on public.patients (organization_id);

create index patients_org_name_idx
  on public.patients (organization_id, last_name, first_name);

create table public.patient_accounts (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null unique references public.patients (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index patient_accounts_profile_id_idx on public.patient_accounts (profile_id);

create table public.treatments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  name text not null,
  category text not null,
  body_area text not null,
  description text,
  start_date date,
  status public.treatment_status not null default 'planned',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint treatments_name_length check (char_length(btrim(name)) between 1 and 120),
  constraint treatments_category_length check (char_length(btrim(category)) between 1 and 80),
  constraint treatments_body_area_length check (char_length(btrim(body_area)) between 1 and 80)
);

create index treatments_patient_id_idx on public.treatments (patient_id);
create index treatments_created_by_idx on public.treatments (created_by);

create table public.photography_protocols (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  version integer not null,
  name text not null,
  created_at timestamptz not null default now(),
  constraint photography_protocols_version_positive check (version > 0),
  constraint photography_protocols_code_version unique (code, version)
);

create table public.photography_angles (
  id uuid primary key default gen_random_uuid(),
  protocol_id uuid not null references public.photography_protocols (id) on delete cascade,
  code text not null,
  name text not null,
  sort_order integer not null,
  instructions text not null,
  constraint photography_angles_code unique (protocol_id, code),
  constraint photography_angles_order unique (protocol_id, sort_order)
);

create index photography_angles_protocol_id_idx
  on public.photography_angles (protocol_id);

create table public.photo_sessions (
  id uuid primary key default gen_random_uuid(),
  treatment_id uuid not null references public.treatments (id) on delete cascade,
  session_type public.session_type not null,
  protocol_id uuid not null references public.photography_protocols (id),
  session_date date not null,
  created_by uuid not null references public.profiles (id),
  status public.session_status not null default 'draft',
  notes text,
  missing_angles_reason text,
  released_to_patient boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index photo_sessions_treatment_id_idx on public.photo_sessions (treatment_id);
create index photo_sessions_protocol_id_idx on public.photo_sessions (protocol_id);
create index photo_sessions_created_by_idx on public.photo_sessions (created_by);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.photo_sessions (id) on delete cascade,
  angle_id uuid not null references public.photography_angles (id),
  body_area text not null,
  storage_path text not null unique,
  source public.photo_source not null,
  captured_at timestamptz,
  uploaded_at timestamptz,
  captured_by uuid not null references public.profiles (id),
  width integer,
  height integer,
  mime_type text,
  file_size_bytes integer,
  sha256 text,
  reference_photo_id uuid references public.photos (id) on delete set null,
  camera_facing text,
  overlay_opacity numeric,
  notes text,
  upload_status public.upload_status not null default 'pending',
  created_at timestamptz not null default now(),
  constraint photos_one_angle_per_session unique (session_id, angle_id),
  constraint photos_file_size check (
    file_size_bytes is null
    or (file_size_bytes > 0 and file_size_bytes <= 10485760)
  ),
  constraint photos_shortest_side check (
    width is null or height is null or least(width, height) >= 1000
  ),
  constraint photos_mime check (
    mime_type is null or mime_type in ('image/jpeg', 'image/png', 'image/webp')
  ),
  constraint photos_sha256 check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),
  constraint photos_facing check (
    camera_facing is null or camera_facing in ('user', 'environment')
  ),
  constraint photos_overlay check (
    overlay_opacity is null or (overlay_opacity >= 0.10 and overlay_opacity <= 0.90)
  ),
  constraint photos_storage_path_shape check (
    storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
  )
);

create index photos_session_id_idx on public.photos (session_id);
create index photos_angle_id_idx on public.photos (angle_id);
create index photos_captured_by_idx on public.photos (captured_by);
create index photos_reference_photo_id_idx on public.photos (reference_photo_id);

create table public.comparisons (
  id uuid primary key default gen_random_uuid(),
  treatment_id uuid not null references public.treatments (id) on delete cascade,
  before_photo_id uuid not null references public.photos (id),
  after_photo_id uuid not null references public.photos (id),
  alignment jsonb not null default '{}'::jsonb,
  shared_with_patient boolean not null default false,
  shared_at timestamptz,
  revoked_at timestamptz,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint comparisons_distinct_photos check (before_photo_id <> after_photo_id)
);

create index comparisons_treatment_id_idx on public.comparisons (treatment_id);
create index comparisons_before_photo_id_idx on public.comparisons (before_photo_id);
create index comparisons_after_photo_id_idx on public.comparisons (after_photo_id);
create index comparisons_created_by_idx on public.comparisons (created_by);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  granted_by uuid references public.profiles (id),
  purpose text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint consents_purpose_length check (char_length(btrim(purpose)) between 1 and 80),
  constraint consents_revoke_after_grant check (
    revoked_at is null or revoked_at >= granted_at
  )
);

create index consents_patient_id_idx on public.consents (patient_id);
create index consents_organization_id_idx on public.consents (organization_id);
create index consents_granted_by_idx on public.consents (granted_by);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_events_org_created_idx
  on public.audit_events (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Record guards
-- ---------------------------------------------------------------------------

create or replace function private.patient_organization_id(target_patient uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select patient.organization_id
  from public.patients as patient
  where patient.id = target_patient;
$$;

create or replace function private.is_patient_self(target_patient uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.patient_accounts as link
    where link.patient_id = target_patient
      and link.profile_id = (select auth.uid())
  );
$$;

create or replace function private.can_staff_patient(target_patient uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_org_staff(private.patient_organization_id(target_patient));
$$;

create or replace function private.can_view_organization(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_org_staff(target_org)
    or exists (
      select 1
      from public.patients as patient
      join public.patient_accounts as link on link.patient_id = patient.id
      where patient.organization_id = target_org
        and link.profile_id = (select auth.uid())
    );
$$;

create or replace function private.treatment_patient_id(target_treatment uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select treatment.patient_id
  from public.treatments as treatment
  where treatment.id = target_treatment;
$$;

create or replace function private.session_patient_id(target_session uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select private.treatment_patient_id(session.treatment_id)
  from public.photo_sessions as session
  where session.id = target_session;
$$;

create or replace function private.photo_patient_id(target_photo uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select private.session_patient_id(photo.session_id)
  from public.photos as photo
  where photo.id = target_photo;
$$;

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
    );
$$;

create or replace function private.guard_profile_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id or new.created_at is distinct from old.created_at then
    raise exception 'This profile field cannot be changed';
  end if;

  return new;
end;
$$;

create or replace function private.guard_organization_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception 'Only the organization name can be changed';
  end if;

  return new;
end;
$$;

create or replace function private.guard_session_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status in ('completed', 'cancelled') then
    raise exception 'Completed or cancelled sessions cannot be modified';
  end if;

  return new;
end;
$$;

create or replace function private.guard_session_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status in ('completed', 'cancelled') then
    raise exception 'Completed or cancelled sessions cannot be deleted';
  end if;

  return old;
end;
$$;

create or replace function private.guard_photo_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.upload_status = 'uploaded' and (
    new.session_id is distinct from old.session_id
    or new.angle_id is distinct from old.angle_id
    or new.storage_path is distinct from old.storage_path
    or new.source is distinct from old.source
    or new.captured_at is distinct from old.captured_at
    or new.uploaded_at is distinct from old.uploaded_at
    or new.captured_by is distinct from old.captured_by
    or new.width is distinct from old.width
    or new.height is distinct from old.height
    or new.mime_type is distinct from old.mime_type
    or new.file_size_bytes is distinct from old.file_size_bytes
    or new.sha256 is distinct from old.sha256
    or new.reference_photo_id is distinct from old.reference_photo_id
    or new.camera_facing is distinct from old.camera_facing
    or new.overlay_opacity is distinct from old.overlay_opacity
    or new.upload_status is distinct from old.upload_status
    or new.body_area is distinct from old.body_area
  ) then
    raise exception 'Uploaded photographs cannot be changed';
  end if;

  return new;
end;
$$;

create or replace function private.guard_photo_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.upload_status = 'uploaded' then
    raise exception 'Uploaded photographs cannot be deleted';
  end if;

  return old;
end;
$$;

create or replace function private.guard_photo_relationships()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_protocol uuid;
  angle_protocol uuid;
  patient_org uuid;
  path_org text;
  reference_angle uuid;
begin
  select session.protocol_id, private.patient_organization_id(private.session_patient_id(session.id))
  into session_protocol, patient_org
  from public.photo_sessions as session
  where session.id = new.session_id;

  select angle.protocol_id
  into angle_protocol
  from public.photography_angles as angle
  where angle.id = new.angle_id;

  if session_protocol is null or angle_protocol is distinct from session_protocol then
    raise exception 'The photograph angle does not belong to the session protocol';
  end if;

  path_org := split_part(new.storage_path, '/', 1);

  if path_org::uuid is distinct from patient_org then
    raise exception 'The photograph must be stored in its clinic folder';
  end if;

  if new.reference_photo_id is not null then
    select photo.angle_id
    into reference_angle
    from public.photos as photo
    where photo.id = new.reference_photo_id;

    if reference_angle is null or reference_angle is distinct from new.angle_id then
      raise exception 'The reference photograph must use the same angle';
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.guard_comparison()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_angle uuid;
  after_angle uuid;
  before_treatment uuid;
  after_treatment uuid;
begin
  select photo.angle_id, session.treatment_id
  into before_angle, before_treatment
  from public.photos as photo
  join public.photo_sessions as session on session.id = photo.session_id
  where photo.id = new.before_photo_id;

  select photo.angle_id, session.treatment_id
  into after_angle, after_treatment
  from public.photos as photo
  join public.photo_sessions as session on session.id = photo.session_id
  where photo.id = new.after_photo_id;

  if before_angle is null
    or after_angle is null
    or before_angle is distinct from after_angle
    or before_treatment is distinct from new.treatment_id
    or after_treatment is distinct from new.treatment_id then
    raise exception 'A comparison must use two photographs of the same angle and treatment';
  end if;

  return new;
end;
$$;

create or replace function private.audit_organization_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.log_audit(new.id, 'organization.created', 'organization', new.id, jsonb_build_object('name', new.name));
  return new;
end;
$$;

create or replace function private.audit_organization_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.name is distinct from old.name then
    perform private.log_audit(
      new.id,
      'organization.renamed',
      'organization',
      new.id,
      jsonb_build_object('from', old.name, 'to', new.name)
    );
  end if;

  return new;
end;
$$;

create or replace function private.audit_member_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.log_audit(
      new.organization_id,
      'member.added',
      'organization_member',
      new.id,
      jsonb_build_object('profile_id', new.profile_id, 'role', new.role)
    );
    return new;
  elsif tg_op = 'UPDATE' then
    perform private.log_audit(
      new.organization_id,
      'member.role_changed',
      'organization_member',
      new.id,
      jsonb_build_object('profile_id', new.profile_id, 'from', old.role, 'to', new.role)
    );
    return new;
  else
    perform private.log_audit(
      old.organization_id,
      'member.removed',
      'organization_member',
      old.id,
      jsonb_build_object('profile_id', old.profile_id, 'role', old.role)
    );
    return old;
  end if;
end;
$$;

create or replace function private.audit_consent_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.log_audit(
      new.organization_id,
      'consent.granted',
      'consent',
      new.id,
      jsonb_build_object('patient_id', new.patient_id, 'purpose', new.purpose)
    );
    return new;
  end if;

  if new.revoked_at is distinct from old.revoked_at and new.revoked_at is not null then
    perform private.log_audit(
      new.organization_id,
      'consent.revoked',
      'consent',
      new.id,
      jsonb_build_object('patient_id', new.patient_id, 'purpose', new.purpose)
    );
  end if;

  return new;
end;
$$;

create or replace function private.audit_release_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  org_id uuid;
begin
  if new.released_to_patient is distinct from old.released_to_patient then
    org_id := private.patient_organization_id(private.session_patient_id(new.id));
    perform private.log_audit(
      org_id,
      case when new.released_to_patient then 'session.released' else 'session.release_revoked' end,
      'photo_session',
      new.id,
      '{}'::jsonb
    );
  end if;

  return new;
end;
$$;

create or replace function private.audit_comparison_share()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  org_id uuid;
begin
  if tg_op = 'UPDATE'
    and new.shared_with_patient is not distinct from old.shared_with_patient
    and new.revoked_at is not distinct from old.revoked_at then
    return new;
  end if;

  org_id := private.patient_organization_id(private.treatment_patient_id(new.treatment_id));

  if new.revoked_at is not null and (tg_op = 'INSERT' or old.revoked_at is null) then
    perform private.log_audit(org_id, 'comparison.revoked', 'comparison', new.id, '{}'::jsonb);
  elsif new.shared_with_patient and new.revoked_at is null then
    perform private.log_audit(org_id, 'comparison.shared', 'comparison', new.id, '{}'::jsonb);
  end if;

  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function private.touch_updated_at();

create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function private.guard_profile_update();

create trigger organizations_touch_updated_at
  before update on public.organizations
  for each row execute function private.touch_updated_at();

create trigger organizations_guard_update
  before update on public.organizations
  for each row execute function private.guard_organization_update();

create trigger organizations_audit_insert
  after insert on public.organizations
  for each row execute function private.audit_organization_insert();

create trigger organizations_audit_update
  after update on public.organizations
  for each row execute function private.audit_organization_update();

create trigger members_audit
  after insert or update or delete on public.organization_members
  for each row execute function private.audit_member_change();

create trigger patients_touch_updated_at
  before update on public.patients
  for each row execute function private.touch_updated_at();

create trigger treatments_touch_updated_at
  before update on public.treatments
  for each row execute function private.touch_updated_at();

create trigger sessions_touch_updated_at
  before update on public.photo_sessions
  for each row execute function private.touch_updated_at();

create trigger sessions_guard_update
  before update on public.photo_sessions
  for each row execute function private.guard_session_update();

create trigger sessions_guard_delete
  before delete on public.photo_sessions
  for each row execute function private.guard_session_delete();

create trigger sessions_audit_release
  after update on public.photo_sessions
  for each row execute function private.audit_release_change();

create trigger photos_guard_update
  before update on public.photos
  for each row execute function private.guard_photo_update();

create trigger photos_guard_delete
  before delete on public.photos
  for each row execute function private.guard_photo_delete();

create trigger photos_guard_relationships
  before insert or update on public.photos
  for each row execute function private.guard_photo_relationships();

create trigger comparisons_touch_updated_at
  before update on public.comparisons
  for each row execute function private.touch_updated_at();

create trigger comparisons_guard
  before insert or update on public.comparisons
  for each row execute function private.guard_comparison();

create trigger comparisons_audit_share
  after insert or update on public.comparisons
  for each row execute function private.audit_comparison_share();

create trigger consents_audit
  after insert or update on public.consents
  for each row execute function private.audit_consent_change();

create or replace function private.guard_created_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'The author cannot be changed';
  end if;

  return new;
end;
$$;

create or replace function private.guard_captured_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.captured_by is distinct from old.captured_by then
    raise exception 'The author cannot be changed';
  end if;

  return new;
end;
$$;

create or replace function private.guard_consent_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.patient_id is distinct from old.patient_id
    or new.organization_id is distinct from old.organization_id
    or new.purpose is distinct from old.purpose
    or new.granted_by is distinct from old.granted_by
    or new.granted_at is distinct from old.granted_at
    or new.created_at is distinct from old.created_at then
    raise exception 'Only consent revocation can be recorded';
  end if;

  return new;
end;
$$;

create trigger treatments_guard_author
  before update on public.treatments
  for each row execute function private.guard_created_by();

create trigger sessions_guard_author
  before update on public.photo_sessions
  for each row execute function private.guard_created_by();

create trigger photos_guard_author
  before update on public.photos
  for each row execute function private.guard_captured_by();

create trigger comparisons_guard_author
  before update on public.comparisons
  for each row execute function private.guard_created_by();

create trigger consents_guard_update
  before update on public.consents
  for each row execute function private.guard_consent_update();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.patients enable row level security;
alter table public.patient_accounts enable row level security;
alter table public.treatments enable row level security;
alter table public.photography_protocols enable row level security;
alter table public.photography_angles enable row level security;
alter table public.photo_sessions enable row level security;
alter table public.photos enable row level security;
alter table public.comparisons enable row level security;
alter table public.consents enable row level security;
alter table public.audit_events enable row level security;

alter table public.profiles force row level security;
alter table public.organizations force row level security;
alter table public.organization_members force row level security;
alter table public.patients force row level security;
alter table public.patient_accounts force row level security;
alter table public.treatments force row level security;
alter table public.photography_protocols force row level security;
alter table public.photography_angles force row level security;
alter table public.photo_sessions force row level security;
alter table public.photos force row level security;
alter table public.comparisons force row level security;
alter table public.consents force row level security;
alter table public.audit_events force row level security;

create policy profiles_select_related
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1
      from public.organization_members as mine
      join public.organization_members as theirs
        on theirs.organization_id = mine.organization_id
      where mine.profile_id = (select auth.uid())
        and theirs.profile_id = profiles.id
    )
  );

create policy profiles_update_self
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy organizations_select
  on public.organizations
  for select
  to authenticated
  using ((select private.can_view_organization(id)));

create policy organizations_update_admin
  on public.organizations
  for update
  to authenticated
  using ((select private.is_org_admin(id)))
  with check ((select private.is_org_admin(id)));

create policy members_select
  on public.organization_members
  for select
  to authenticated
  using (
    profile_id = (select auth.uid())
    or (select private.is_org_staff(organization_id))
  );

create policy patients_select
  on public.patients
  for select
  to authenticated
  using (
    (select private.can_staff_patient(id))
    or (select private.is_patient_self(id))
  );

create policy patients_insert_staff
  on public.patients
  for insert
  to authenticated
  with check ((select private.is_org_staff(organization_id)));

create policy patients_update_staff
  on public.patients
  for update
  to authenticated
  using ((select private.can_staff_patient(id)))
  with check ((select private.is_org_staff(organization_id)));

create policy patient_accounts_select
  on public.patient_accounts
  for select
  to authenticated
  using (
    profile_id = (select auth.uid())
    or (select private.can_staff_patient(patient_id))
  );

create policy treatments_select
  on public.treatments
  for select
  to authenticated
  using (
    (select private.can_staff_patient(patient_id))
    or (select private.is_patient_self(patient_id))
  );

create policy treatments_insert_staff
  on public.treatments
  for insert
  to authenticated
  with check (
    (select private.can_staff_patient(patient_id))
    and created_by = (select auth.uid())
  );

create policy treatments_update_staff
  on public.treatments
  for update
  to authenticated
  using ((select private.can_staff_patient(patient_id)))
  with check ((select private.can_staff_patient(patient_id)));

create policy protocols_select
  on public.photography_protocols
  for select
  to authenticated
  using (true);

create policy angles_select
  on public.photography_angles
  for select
  to authenticated
  using (true);

create policy sessions_select
  on public.photo_sessions
  for select
  to authenticated
  using (
    (select private.can_staff_patient(private.session_patient_id(id)))
    or (select private.is_patient_self(private.session_patient_id(id)))
  );

create policy sessions_insert_staff
  on public.photo_sessions
  for insert
  to authenticated
  with check (
    (select private.can_staff_patient(private.treatment_patient_id(treatment_id)))
    and created_by = (select auth.uid())
  );

create policy sessions_update_staff
  on public.photo_sessions
  for update
  to authenticated
  using ((select private.can_staff_patient(private.session_patient_id(id))))
  with check ((select private.can_staff_patient(private.treatment_patient_id(treatment_id))));

create policy sessions_delete_draft_staff
  on public.photo_sessions
  for delete
  to authenticated
  using (
    status = 'draft'
    and (select private.can_staff_patient(private.session_patient_id(id)))
  );

create policy photos_select
  on public.photos
  for select
  to authenticated
  using (
    (select private.can_staff_patient(private.photo_patient_id(id)))
    or (select private.patient_can_view_photo(id))
  );

create policy photos_insert_staff
  on public.photos
  for insert
  to authenticated
  with check (
    (select private.can_staff_patient(private.session_patient_id(session_id)))
    and captured_by = (select auth.uid())
  );

create policy photos_update_pending_staff
  on public.photos
  for update
  to authenticated
  using (
    upload_status <> 'uploaded'
    and (select private.can_staff_patient(private.photo_patient_id(id)))
  )
  with check ((select private.can_staff_patient(private.session_patient_id(session_id))));

create policy photos_delete_pending_staff
  on public.photos
  for delete
  to authenticated
  using (
    upload_status <> 'uploaded'
    and (select private.can_staff_patient(private.photo_patient_id(id)))
  );

create policy comparisons_select
  on public.comparisons
  for select
  to authenticated
  using (
    (select private.can_staff_patient(private.treatment_patient_id(treatment_id)))
    or (
      shared_with_patient
      and revoked_at is null
      and (select private.is_patient_self(private.treatment_patient_id(treatment_id)))
    )
  );

create policy comparisons_insert_staff
  on public.comparisons
  for insert
  to authenticated
  with check (
    (select private.can_staff_patient(private.treatment_patient_id(treatment_id)))
    and created_by = (select auth.uid())
  );

create policy comparisons_update_staff
  on public.comparisons
  for update
  to authenticated
  using ((select private.can_staff_patient(private.treatment_patient_id(treatment_id))))
  with check ((select private.can_staff_patient(private.treatment_patient_id(treatment_id))));

create policy consents_select
  on public.consents
  for select
  to authenticated
  using (
    (select private.is_org_staff(organization_id))
    or (select private.is_patient_self(patient_id))
  );

create policy consents_insert_staff
  on public.consents
  for insert
  to authenticated
  with check (
    (select private.is_org_staff(organization_id))
    and (select private.can_staff_patient(patient_id))
    and granted_by = (select auth.uid())
  );

create policy consents_update_staff
  on public.consents
  for update
  to authenticated
  using ((select private.is_org_staff(organization_id)))
  with check (
    (select private.is_org_staff(organization_id))
    and (select private.can_staff_patient(patient_id))
  );

create policy audit_select_admin
  on public.audit_events
  for select
  to authenticated
  using ((select private.is_org_admin(organization_id)));

-- ---------------------------------------------------------------------------
-- API grants. Clients cannot insert clinics or members directly.
-- ---------------------------------------------------------------------------

revoke all on table
  public.profiles,
  public.organizations,
  public.organization_members,
  public.patients,
  public.patient_accounts,
  public.treatments,
  public.photography_protocols,
  public.photography_angles,
  public.photo_sessions,
  public.photos,
  public.comparisons,
  public.consents,
  public.audit_events
from public, anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select, update on public.organizations to authenticated;
grant select on public.organization_members to authenticated;
grant select, insert, update on public.patients to authenticated;
grant select on public.patient_accounts to authenticated;
grant select, insert, update on public.treatments to authenticated;
grant select on public.photography_protocols to authenticated;
grant select on public.photography_angles to authenticated;
grant select, insert, update, delete on public.photo_sessions to authenticated;
grant select, insert, update, delete on public.photos to authenticated;
grant select, insert, update on public.comparisons to authenticated;
grant select, insert, update on public.consents to authenticated;
grant select on public.audit_events to authenticated;

create or replace function public.create_organization(org_name text)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.create_organization(org_name);
$$;

create or replace function public.add_organization_member(
  target_org uuid,
  member_email text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.add_organization_member(target_org, member_email);
end;
$$;

create or replace function public.set_organization_member_role(
  target_org uuid,
  target_profile uuid,
  next_role public.organization_role
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.set_organization_member_role(target_org, target_profile, next_role);
end;
$$;

create or replace function public.remove_organization_member(
  target_org uuid,
  target_profile uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.remove_organization_member(target_org, target_profile);
end;
$$;

revoke all on function public.create_organization(text) from public;
revoke all on function public.add_organization_member(uuid, text) from public;
revoke all on function public.set_organization_member_role(uuid, uuid, public.organization_role) from public;
revoke all on function public.remove_organization_member(uuid, uuid) from public;

grant execute on function public.create_organization(text) to authenticated;
grant execute on function public.add_organization_member(uuid, text) to authenticated;
grant execute on function public.set_organization_member_role(uuid, uuid, public.organization_role) to authenticated;
grant execute on function public.remove_organization_member(uuid, uuid) to authenticated;

revoke all on all functions in schema private from public;
grant execute on all functions in schema private to authenticated;
grant execute on function private.handle_new_user() to supabase_auth_admin;
grant usage on schema private to supabase_auth_admin;

-- ---------------------------------------------------------------------------
-- Private clinical photographs. Originals cannot be replaced or deleted.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'clinical-photos',
  'clinical-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
);

create policy clinical_photos_staff_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'clinical-photos'
    and (select private.is_org_staff((storage.foldername(name))[1]::uuid))
  );

create policy clinical_photos_staff_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'clinical-photos'
    and (select private.is_org_staff((storage.foldername(name))[1]::uuid))
  );

-- ---------------------------------------------------------------------------
-- FACE_STANDARD version 1. Left and right are the patient's left and right.
-- ---------------------------------------------------------------------------

insert into public.photography_protocols (id, code, version, name)
values (
  '10000000-0000-4000-8000-000000000001',
  'FACE_STANDARD',
  1,
  'Standard facial series'
);

insert into public.photography_angles (protocol_id, code, name, sort_order, instructions)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'front',
    'Front — 0 degrees',
    1,
    'Patient faces the camera directly. Eyes remain level. Head remains straight. Neutral facial expression. Entire face is visible. Nose aligned with the vertical guide.'
  ),
  (
    '10000000-0000-4000-8000-000000000001',
    'left_45',
    'Left — 45 degrees',
    2,
    'Patient turns their head approximately 45 degrees toward their own left. Maintain consistent head height. Maintain neutral expression. Keep the entire face visible.'
  ),
  (
    '10000000-0000-4000-8000-000000000001',
    'right_45',
    'Right — 45 degrees',
    3,
    'Patient turns their head approximately 45 degrees toward their own right. Maintain consistent head height. Maintain neutral expression.'
  ),
  (
    '10000000-0000-4000-8000-000000000001',
    'left_90',
    'Left profile — 90 degrees',
    4,
    'Patient turns their head toward their own left. Capture a complete side profile. Nose, chin, forehead, and jawline should be visible.'
  ),
  (
    '10000000-0000-4000-8000-000000000001',
    'right_90',
    'Right profile — 90 degrees',
    5,
    'Patient turns their head toward their own right. Capture a complete side profile.'
  );
