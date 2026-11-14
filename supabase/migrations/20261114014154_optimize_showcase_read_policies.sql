-- One SELECT policy per role avoids duplicate policy evaluation, without granting
-- anonymous callers access to private membership helpers.
alter policy clinic_profile_public_read on public.clinic_profiles to anon;
alter policy clinic_profile_staff_read on public.clinic_profiles using(published or (select private.is_org_staff(organization_id)));
alter policy showcase_public_read on public.clinic_showcase_results to anon;
alter policy showcase_staff_read on public.clinic_showcase_results using((select private.is_org_staff(organization_id)) or (published and exists(select 1 from public.clinic_profiles p where p.organization_id=clinic_showcase_results.organization_id and p.published)));
