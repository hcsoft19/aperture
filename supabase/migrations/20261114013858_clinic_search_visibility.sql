-- Public contact pages can remain shareable without being listed in search.
alter table public.clinic_profiles add column allow_indexing boolean not null default true;
