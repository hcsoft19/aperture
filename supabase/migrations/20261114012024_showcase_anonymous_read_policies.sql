-- Anonymous policies must not evaluate staff-only private helper functions.
drop policy clinic_profile_read on public.clinic_profiles;
create policy clinic_profile_public_read on public.clinic_profiles for select to anon,authenticated using(published);
create policy clinic_profile_staff_read on public.clinic_profiles for select to authenticated using((select private.is_org_staff(organization_id)));
drop policy showcase_read on public.clinic_showcase_results;
create policy showcase_public_read on public.clinic_showcase_results for select to anon,authenticated using(published and exists(select 1 from public.clinic_profiles p where p.organization_id=clinic_showcase_results.organization_id and p.published));
create policy showcase_staff_read on public.clinic_showcase_results for select to authenticated using((select private.is_org_staff(organization_id)));
revoke all on function private.reserve_clinic_slug(),private.record_clinic_slug(),private.guard_showcase(),private.guard_publication_permission(),private.withdraw_publication() from public,anon;
grant execute on function private.reserve_clinic_slug(),private.record_clinic_slug(),private.guard_showcase(),private.guard_publication_permission(),private.withdraw_publication() to authenticated;
