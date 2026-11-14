-- Clinic-scoped catalog options for treatment dropdowns.
-- Each clinic maintains its own vocabulary for treatment names, categories,
-- procedure types, products, and body areas.

-- ---------------------------------------------------------------------------
-- Enum for option types
-- ---------------------------------------------------------------------------

create type public.catalog_option_type as enum (
  'treatment_name',
  'category',
  'procedure_type',
  'product',
  'body_area'
);

-- ---------------------------------------------------------------------------
-- Catalog options table
-- ---------------------------------------------------------------------------

create table public.clinic_catalog_options (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  option_type public.catalog_option_type not null,
  normalized_key text not null,
  display_name text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinic_catalog_options_display_name_length check (
    char_length(btrim(display_name)) between 1 and 120
  ),
  constraint clinic_catalog_options_normalized_key_format check (
    normalized_key = lower(btrim(display_name))
  ),
  constraint clinic_catalog_options_unique_per_org unique (
    organization_id, option_type, normalized_key
  )
);

create index clinic_catalog_options_org_type_active_idx
  on public.clinic_catalog_options (organization_id, option_type)
  where is_active = true;

create index clinic_catalog_options_org_type_sort_idx
  on public.clinic_catalog_options (organization_id, option_type, sort_order, display_name);

create trigger clinic_catalog_options_touch_updated_at
  before update on public.clinic_catalog_options
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.clinic_catalog_options enable row level security;
alter table public.clinic_catalog_options force row level security;

-- Staff can read their clinic's catalog
create policy clinic_catalog_options_select_staff
  on public.clinic_catalog_options
  for select
  to authenticated
  using ((select private.is_org_staff(organization_id)));

-- Staff can insert new options
create policy clinic_catalog_options_insert_staff
  on public.clinic_catalog_options
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and (select private.is_org_staff(organization_id))
  );

-- Admin can update options (rename, deactivate, reorder)
create policy clinic_catalog_options_update_admin
  on public.clinic_catalog_options
  for update
  to authenticated
  using ((select private.is_org_staff(organization_id)))
  with check ((select private.is_org_admin(organization_id)));

-- ---------------------------------------------------------------------------
-- API grants
-- ---------------------------------------------------------------------------

revoke all on public.clinic_catalog_options from public, anon;
grant select, insert, update on public.clinic_catalog_options to authenticated;

-- ---------------------------------------------------------------------------
-- Backfill existing treatment values into catalog
-- ---------------------------------------------------------------------------

-- Helper to get a clinic admin for created_by
create or replace function private.get_clinic_admin(target_org uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select profile_id
  from public.organization_members
  where organization_id = target_org
    and role = 'clinic_admin'
  limit 1;
$$;

-- Backfill treatment names
insert into public.clinic_catalog_options (organization_id, option_type, normalized_key, display_name, created_by)
select distinct
  p.organization_id,
  'treatment_name'::catalog_option_type,
  lower(btrim(t.name)),
  btrim(t.name),
  coalesce(
    private.get_clinic_admin(p.organization_id),
    t.created_by
  )
from public.treatments t
join public.patients p on p.id = t.patient_id
where btrim(t.name) <> ''
on conflict (organization_id, option_type, normalized_key) do nothing;

-- Backfill categories
insert into public.clinic_catalog_options (organization_id, option_type, normalized_key, display_name, created_by)
select distinct
  p.organization_id,
  'category'::catalog_option_type,
  lower(btrim(t.category)),
  btrim(t.category),
  coalesce(
    private.get_clinic_admin(p.organization_id),
    t.created_by
  )
from public.treatments t
join public.patients p on p.id = t.patient_id
where btrim(t.category) <> ''
on conflict (organization_id, option_type, normalized_key) do nothing;

-- Backfill procedure types
insert into public.clinic_catalog_options (organization_id, option_type, normalized_key, display_name, created_by)
select distinct
  p.organization_id,
  'procedure_type'::catalog_option_type,
  lower(btrim(t.procedure_type)),
  btrim(t.procedure_type),
  coalesce(
    private.get_clinic_admin(p.organization_id),
    t.created_by
  )
from public.treatments t
join public.patients p on p.id = t.patient_id
where btrim(t.procedure_type) <> ''
on conflict (organization_id, option_type, normalized_key) do nothing;

-- Backfill products
insert into public.clinic_catalog_options (organization_id, option_type, normalized_key, display_name, created_by)
select distinct
  p.organization_id,
  'product'::catalog_option_type,
  lower(btrim(t.product_name)),
  btrim(t.product_name),
  coalesce(
    private.get_clinic_admin(p.organization_id),
    t.created_by
  )
from public.treatments t
join public.patients p on p.id = t.patient_id
where btrim(t.product_name) <> ''
on conflict (organization_id, option_type, normalized_key) do nothing;

-- Backfill body areas
insert into public.clinic_catalog_options (organization_id, option_type, normalized_key, display_name, created_by)
select distinct
  p.organization_id,
  'body_area'::catalog_option_type,
  lower(btrim(t.body_area)),
  btrim(t.body_area),
  coalesce(
    private.get_clinic_admin(p.organization_id),
    t.created_by
  )
from public.treatments t
join public.patients p on p.id = t.patient_id
where btrim(t.body_area) <> ''
on conflict (organization_id, option_type, normalized_key) do nothing;

-- Clean up helper function
drop function private.get_clinic_admin(uuid);
