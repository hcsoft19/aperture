-- Cover the new reference-case creator relationship for profile maintenance.
create index gallery_demo_cases_created_by_idx on public.gallery_demo_cases(created_by);
