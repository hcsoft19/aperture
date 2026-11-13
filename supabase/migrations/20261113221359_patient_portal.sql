-- A completed session can be released or withdrawn. The photographs stay immutable.
-- Invitations link an existing chart to the account that accepts the link.

create or replace function private.guard_session_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'cancelled' then
    raise exception 'Cancelled sessions cannot be modified';
  end if;

  if old.status = 'completed' then
    if new.id is distinct from old.id
      or new.treatment_id is distinct from old.treatment_id
      or new.session_type is distinct from old.session_type
      or new.protocol_id is distinct from old.protocol_id
      or new.session_date is distinct from old.session_date
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at
      or new.status is distinct from old.status
      or new.notes is distinct from old.notes
      or new.missing_angles_reason is distinct from old.missing_angles_reason then
      raise exception 'Completed sessions cannot be modified';
    end if;
  end if;

  return new;
end;
$$;

create table public.patient_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  invited_by uuid not null references public.profiles (id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint patient_invitations_email_length check (char_length(btrim(email)) between 3 and 320),
  constraint patient_invitations_email_shape check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint patient_invitations_token_hash check (token_hash ~ '^[a-f0-9]{64}$'),
  constraint patient_invitations_expiry check (expires_at > created_at)
);

create index patient_invitations_patient_id_idx on public.patient_invitations (patient_id);
create unique index patient_invitations_one_open_idx
  on public.patient_invitations (patient_id)
  where accepted_at is null and revoked_at is null;

create or replace function private.guard_invitation_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.organization_id is distinct from old.organization_id
    or new.patient_id is distinct from old.patient_id
    or new.email is distinct from old.email
    or new.token_hash is distinct from old.token_hash
    or new.invited_by is distinct from old.invited_by
    or new.expires_at is distinct from old.expires_at
    or new.created_at is distinct from old.created_at then
    raise exception 'This invitation field cannot be changed';
  end if;

  return new;
end;
$$;

create trigger patient_invitations_guard_update
  before update on public.patient_invitations
  for each row execute function private.guard_invitation_update();

alter table public.patient_invitations enable row level security;
alter table public.patient_invitations force row level security;

create policy patient_invitations_select_staff
  on public.patient_invitations
  for select
  to authenticated
  using ((select private.can_staff_patient(patient_id)));

create policy patient_invitations_insert_staff
  on public.patient_invitations
  for insert
  to authenticated
  with check (
    (select private.can_staff_patient(patient_id))
    and (select private.is_org_staff(organization_id))
    and invited_by = (select auth.uid())
  );

create policy patient_invitations_update_staff
  on public.patient_invitations
  for update
  to authenticated
  using ((select private.can_staff_patient(patient_id)))
  with check ((select private.can_staff_patient(patient_id)));

revoke all on table public.patient_invitations from public, anon, authenticated;
grant select, insert, update on public.patient_invitations to authenticated;

create or replace function private.accept_patient_invitation(raw_token text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_email text := lower(auth.email());
  token_digest text;
  invite public.patient_invitations%rowtype;
  existing_profile uuid;
begin
  if caller is null
    or caller_email is null
    or raw_token is null
    or char_length(raw_token) < 32
    or char_length(raw_token) > 128 then
    return 'unavailable';
  end if;

  token_digest := encode(extensions.digest(convert_to(raw_token, 'UTF8'), 'sha256'), 'hex');

  select *
  into invite
  from public.patient_invitations
  where token_hash = token_digest;

  if invite.id is null
    or invite.revoked_at is not null
    or invite.expires_at <= now()
    or lower(invite.email) <> caller_email then
    return 'unavailable';
  end if;

  select link.profile_id
  into existing_profile
  from public.patient_accounts as link
  where link.patient_id = invite.patient_id;

  if existing_profile is not null and existing_profile <> caller then
    return 'unavailable';
  end if;

  if existing_profile is null then
    insert into public.patient_accounts (patient_id, profile_id)
    values (invite.patient_id, caller);
  end if;

  if invite.accepted_at is null then
    update public.patient_invitations
    set accepted_at = now()
    where id = invite.id;
  end if;

  return 'accepted';
end;
$$;

create or replace function public.accept_patient_invitation(raw_token text)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.accept_patient_invitation(raw_token);
$$;

revoke all on function public.accept_patient_invitation(text) from public, anon;
grant execute on function public.accept_patient_invitation(text) to authenticated;
grant execute on function private.accept_patient_invitation(text) to authenticated;

create policy clinical_photos_patient_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'clinical-photos'
    and exists (
      select 1
      from public.photos
      where photos.storage_path = objects.name
        and (select private.patient_can_view_photo(photos.id))
    )
  );
