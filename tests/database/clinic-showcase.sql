-- Run against the seeded LOCAL Supabase database; every mutation rolls back.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
insert into public.clinic_profiles(organization_id,slug,display_name,introduction,phone)
values('33333333-3333-4333-8333-333333333333','rls-showcase-test','Fictional test clinic','A fictional clinic for transaction-scoped access tests.','+1 305 555 0100');
insert into public.clinic_showcase_results(id,organization_id,slug,title,category,summary,before_path,after_path)
values('88888888-8888-4888-8888-888888888888','33333333-3333-4333-8333-333333333333','synthetic-test','Synthetic example','Demo','This is a synthetic example for access testing.','33333333-3333-4333-8333-333333333333/results/88888888-8888-4888-8888-888888888888/before.webp','33333333-3333-4333-8333-333333333333/results/88888888-8888-4888-8888-888888888888/after.webp');
do $$ begin
 begin update public.clinic_showcase_results set published=true where id='88888888-8888-4888-8888-888888888888'; raise exception 'TEST FAILED: allowed publication without permission';
 exception when raise_exception then if sqlerrm<>'Public permission required' then raise; end if; end;
end $$;
insert into public.clinic_publication_permissions(result_id,organization_id,comparison_id,consent_reference,confirmed_by)
select '88888888-8888-4888-8888-888888888888','33333333-3333-4333-8333-333333333333',c.id,'SYNTHETIC-TEST-PERMISSION','11111111-1111-4111-8111-111111111111'
from public.comparisons c join public.treatments t on t.id=c.treatment_id join public.patients p on p.id=t.patient_id where p.organization_id='33333333-3333-4333-8333-333333333333' limit 1;
set local role anon;
select 1/(case when count(*)=0 then 1 else 0 end) as drafts_hidden from public.clinic_profiles;
select 1/(case when count(*)=0 then 1 else 0 end) as draft_results_hidden from public.clinic_showcase_results;
do $$ begin
 begin perform 1 from public.clinic_publication_permissions; raise exception 'TEST FAILED: anonymous permission record access';
 exception when insufficient_privilege then null; end;
end $$;
set local role authenticated;
update public.clinic_profiles set published=true where slug='rls-showcase-test';
update public.clinic_showcase_results set published=true where id='88888888-8888-4888-8888-888888888888';
set local role anon;
select 1/(case when count(*)=1 then 1 else 0 end) as published_profile_visible from public.clinic_profiles where slug='rls-showcase-test';
select 1/(case when count(*)=1 then 1 else 0 end) as published_result_visible from public.clinic_showcase_results where id='88888888-8888-4888-8888-888888888888';
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
with attempted as (update public.clinic_profiles set display_name='Unauthorized change' where slug='rls-showcase-test' returning organization_id) select 1/(case when count(*)=0 then 1 else 0 end) as patient_cannot_edit from attempted;
select 1/(case when count(*)=0 then 1 else 0 end) as patient_cannot_read_permissions from public.clinic_publication_permissions;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
update public.clinic_publication_permissions set revoked_at=now() where result_id='88888888-8888-4888-8888-888888888888';
set local role anon;
select 1/(case when count(*)=0 then 1 else 0 end) as revoked_result_hidden from public.clinic_showcase_results;
set local role authenticated;
update public.clinic_profiles set slug='rls-showcase-renamed' where slug='rls-showcase-test';
set local role anon;
select 1/(case when count(*)=1 then 1 else 0 end) as old_slug_reserved from public.clinic_slug_reservations where slug='rls-showcase-test';
set local role authenticated;
update public.clinic_profiles set published=false where slug='rls-showcase-renamed';
set local role anon;
select 1/(case when count(*)=0 then 1 else 0 end) as offline_profile_hidden from public.clinic_profiles;
rollback;
