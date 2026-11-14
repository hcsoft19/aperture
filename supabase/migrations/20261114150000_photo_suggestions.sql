-- Accepted and rejected photography suggestions. Payloads are small metadata only.
-- Original photographs, pixels, landmarks, and embeddings are not stored here.

create table public.photo_suggestions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  photo_id uuid references public.photos (id) on delete cascade,
  comparison_id uuid references public.comparisons (id) on delete cascade,
  kind text not null,
  heuristic_version text not null,
  model_id text,
  status text not null,
  confidence numeric,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint photo_suggestions_kind check (
    kind in ('framing', 'alignment', 'segmentation', 'recommendation')
  ),
  constraint photo_suggestions_status check (status in ('suggested', 'accepted', 'rejected')),
  constraint photo_suggestions_version_length check (char_length(heuristic_version) between 1 and 40),
  constraint photo_suggestions_model_length check (model_id is null or char_length(model_id) between 1 and 80),
  constraint photo_suggestions_confidence check (confidence is null or (confidence >= 0 and confidence <= 1)),
  constraint photo_suggestions_target check (photo_id is not null or comparison_id is not null),
  constraint photo_suggestions_payload_size check (octet_length(payload::text) <= 4000)
);

create index photo_suggestions_organization_id_idx
  on public.photo_suggestions (organization_id, created_at desc);

alter table public.photo_suggestions enable row level security;
alter table public.photo_suggestions force row level security;

create policy photo_suggestions_select_staff
  on public.photo_suggestions
  for select
  to authenticated
  using ((select private.is_org_staff(organization_id)));

create policy photo_suggestions_insert_staff
  on public.photo_suggestions
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and (select private.is_org_staff(organization_id))
  );

revoke all on public.photo_suggestions from public, anon;
grant select, insert on public.photo_suggestions to authenticated;
