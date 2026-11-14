-- Non-destructive presentation edits. Original photographs stay immutable.

create or replace function private.photo_organization_id(target_photo uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select private.patient_organization_id(private.photo_patient_id(target_photo));
$$;

create table public.photo_edit_revisions (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photos (id) on delete cascade,
  revision_number integer not null,
  schema_version integer not null,
  edit_data jsonb not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint photo_edit_revisions_number_positive check (revision_number > 0),
  constraint photo_edit_revisions_schema_version check (schema_version = 1),
  constraint photo_edit_revisions_unique unique (photo_id, revision_number)
);

create index photo_edit_revisions_photo_id_idx
  on public.photo_edit_revisions (photo_id, revision_number desc);

create table public.photo_derivatives (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photos (id) on delete cascade,
  edit_revision_id uuid not null references public.photo_edit_revisions (id),
  storage_path text not null unique,
  mime_type text not null,
  width integer not null,
  height integer not null,
  file_size_bytes integer not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint photo_derivatives_mime check (mime_type in ('image/jpeg', 'image/png')),
  constraint photo_derivatives_size check (file_size_bytes > 0 and file_size_bytes <= 10485760),
  constraint photo_derivatives_dimensions check (width > 0 and height > 0 and width <= 8000 and height <= 8000),
  constraint photo_derivatives_path_shape check (
    storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png)$'
  )
);

create index photo_derivatives_photo_id_idx on public.photo_derivatives (photo_id);
create index photo_derivatives_revision_id_idx on public.photo_derivatives (edit_revision_id);

alter table public.photo_edit_revisions enable row level security;
alter table public.photo_derivatives enable row level security;
alter table public.photo_edit_revisions force row level security;
alter table public.photo_derivatives force row level security;

create policy photo_edit_revisions_select_staff
  on public.photo_edit_revisions
  for select
  to authenticated
  using ((select private.is_org_staff(private.photo_organization_id(photo_id))));

create policy photo_edit_revisions_insert_staff
  on public.photo_edit_revisions
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
        and photo.upload_status = 'uploaded'
    )
  );

create policy photo_derivatives_select_authorized
  on public.photo_derivatives
  for select
  to authenticated
  using (
    (select private.is_org_staff(private.photo_organization_id(photo_id)))
    or (select private.patient_can_view_photo(photo_id))
  );

create policy photo_derivatives_insert_staff
  on public.photo_derivatives
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and (select private.is_org_staff(private.photo_organization_id(photo_id)))
    and split_part(storage_path, '/', 1)::uuid = private.photo_organization_id(photo_id)
    and exists (
      select 1
      from public.photo_edit_revisions as revision
      where revision.id = edit_revision_id
        and revision.photo_id = photo_id
    )
  );

revoke all on table public.photo_edit_revisions, public.photo_derivatives
  from public, anon, authenticated;
grant select, insert on public.photo_edit_revisions to authenticated;
grant select, insert on public.photo_derivatives to authenticated;

create or replace function public.record_clinical_event(
  target_org uuid,
  action text,
  entity_type text,
  entity_id uuid,
  metadata jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select private.is_org_staff(target_org)) then
    raise exception 'Not allowed';
  end if;

  if action not in ('photo.edit_saved', 'photo.exported') then
    raise exception 'Not allowed';
  end if;

  perform private.log_audit(target_org, action, entity_type, entity_id, metadata);
end;
$$;

revoke all on function public.record_clinical_event(uuid, text, text, uuid, jsonb) from public, anon;
grant execute on function public.record_clinical_event(uuid, text, text, uuid, jsonb) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photo-derivatives',
  'photo-derivatives',
  false,
  10485760,
  array['image/jpeg', 'image/png']
);

create policy photo_derivatives_staff_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'photo-derivatives'
    and (select private.is_org_staff((storage.foldername(name))[1]::uuid))
  );

create policy photo_derivatives_staff_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'photo-derivatives'
    and (select private.is_org_staff((storage.foldername(name))[1]::uuid))
  );

create policy photo_derivatives_patient_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'photo-derivatives'
    and exists (
      select 1
      from public.photo_derivatives as derivative
      where derivative.storage_path = name
        and (select private.patient_can_view_photo(derivative.photo_id))
    )
  );
