-- Privacy requests. The existing audit_events table stays append-only.
-- Photographs and image bytes are not stored here.

create table public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  kind text not null,
  status text not null default 'requested',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint privacy_requests_kind check (kind in ('export', 'deletion')),
  constraint privacy_requests_status check (status = 'requested')
);

create index privacy_requests_organization_id_idx
  on public.privacy_requests (organization_id, created_at desc);

alter table public.privacy_requests enable row level security;
alter table public.privacy_requests force row level security;

create policy privacy_requests_select_admin
  on public.privacy_requests
  for select
  to authenticated
  using ((select private.is_org_admin(organization_id)));

revoke all on public.privacy_requests from public, anon, authenticated;
grant select on public.privacy_requests to authenticated;

create or replace function public.record_privacy_request(
  target_patient uuid,
  kind text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_org uuid;
  request_id uuid;
  audit_action text;
begin
  if (select auth.uid()) is null then
    raise exception 'Administrator required';
  end if;

  if kind not in ('export', 'deletion') then
    raise exception 'This request could not be prepared.';
  end if;

  target_org := private.patient_organization_id(target_patient);
  if target_org is null or not private.is_org_admin(target_org) then
    raise exception 'Administrator required';
  end if;

  insert into public.privacy_requests (
    organization_id,
    patient_id,
    kind,
    status,
    created_by
  )
  values (
    target_org,
    target_patient,
    kind,
    'requested',
    (select auth.uid())
  )
  returning id into request_id;

  audit_action := case
    when kind = 'deletion' then 'privacy_deletion_requested'
    else 'privacy_export_requested'
  end;

  perform private.log_audit(
    target_org,
    audit_action,
    'privacy_request',
    request_id,
    jsonb_build_object('status', 'requested')
  );

  return request_id;
end;
$$;

revoke all on function public.record_privacy_request(uuid, text) from public, anon;
grant execute on function public.record_privacy_request(uuid, text) to authenticated;

create or replace function public.record_readiness_audit(
  target_org uuid,
  action text,
  subject_id uuid,
  status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not private.is_org_staff(target_org) then
    raise exception 'This audit event cannot be recorded.';
  end if;

  if action not in (
    'consent_granted',
    'consent_withdrawn',
    'progress_released',
    'progress_revoked',
    'privacy_export_requested',
    'privacy_deletion_requested'
  ) then
    raise exception 'This audit event cannot be recorded.';
  end if;

  if status not in ('granted', 'withdrawn', 'released', 'revoked', 'requested') then
    raise exception 'This audit event cannot be recorded.';
  end if;

  perform private.log_audit(
    target_org,
    action,
    'subject',
    subject_id,
    jsonb_build_object('status', status)
  );
end;
$$;

revoke all on function public.record_readiness_audit(uuid, text, uuid, text) from public, anon;
grant execute on function public.record_readiness_audit(uuid, text, uuid, text) to authenticated;
