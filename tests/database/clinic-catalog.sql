-- RLS tests for clinic_catalog_options table
-- Run against a test database with the schema and seed applied

begin;
select plan(8);

-- Setup: Create test users and organizations
insert into auth.users (id, email, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', 'admin1@clinic1.test', '{}'),
  ('22222222-2222-2222-2222-222222222222', 'pro1@clinic1.test', '{}'),
  ('33333333-3333-3333-3333-333333333333', 'admin2@clinic2.test', '{}'),
  ('44444444-4444-4444-4444-444444444444', 'patient1@test.test', '{}');

-- Create organizations
insert into public.organizations (id, name, created_by)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Clinic One', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Clinic Two', '33333333-3333-3333-3333-333333333333');

-- Add members
insert into public.organization_members (organization_id, profile_id, role)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'clinic_admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'professional'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', 'clinic_admin');

-- Create a patient and link
insert into public.patients (id, organization_id, first_name, last_name)
values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Test', 'Patient');

insert into public.patient_accounts (patient_id, profile_id)
values ('cccccccc-cccc-cccc-cccc-cccccccccccc', '44444444-4444-4444-4444-444444444444');

-- Insert test catalog options
insert into public.clinic_catalog_options (id, organization_id, option_type, normalized_key, display_name, created_by)
values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'category', 'botox', 'Botox', '11111111-1111-1111-1111-111111111111'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'category', 'filler', 'Filler', '33333333-3333-3333-3333-333333333333');

-- Test 1: Admin can read their clinic's options
set local role authenticated;
set local request.jwt.claim.sub to '11111111-1111-1111-1111-111111111111';
select is(
  (select count(*)::int from public.clinic_catalog_options where organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1,
  'Admin can read own clinic catalog options'
);

-- Test 2: Professional can read their clinic's options
set local request.jwt.claim.sub to '22222222-2222-2222-2222-222222222222';
select is(
  (select count(*)::int from public.clinic_catalog_options where organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1,
  'Professional can read own clinic catalog options'
);

-- Test 3: Admin cannot read other clinic's options
set local request.jwt.claim.sub to '11111111-1111-1111-1111-111111111111';
select is(
  (select count(*)::int from public.clinic_catalog_options where organization_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  0,
  'Admin cannot read other clinic catalog options'
);

-- Test 4: Patient cannot read catalog options
set local request.jwt.claim.sub to '44444444-4444-4444-4444-444444444444';
select is(
  (select count(*)::int from public.clinic_catalog_options),
  0,
  'Patient cannot read any catalog options'
);

-- Test 5: Admin can insert new option
set local request.jwt.claim.sub to '11111111-1111-1111-1111-111111111111';
insert into public.clinic_catalog_options (organization_id, option_type, normalized_key, display_name, created_by)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'treatment_name', 'lip filler', 'Lip Filler', '11111111-1111-1111-1111-111111111111');
select is(
  (select count(*)::int from public.clinic_catalog_options where organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  2,
  'Admin can insert new option'
);

-- Test 6: Professional can insert new option
set local request.jwt.claim.sub to '22222222-2222-2222-2222-222222222222';
insert into public.clinic_catalog_options (organization_id, option_type, normalized_key, display_name, created_by)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'body_area', 'face', 'Face', '22222222-2222-2222-2222-222222222222');
select is(
  (select count(*)::int from public.clinic_catalog_options where organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  3,
  'Professional can insert new option'
);

-- Test 7: Admin can update option
set local request.jwt.claim.sub to '11111111-1111-1111-1111-111111111111';
update public.clinic_catalog_options
set display_name = 'Botox Treatment', normalized_key = 'botox treatment'
where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
select is(
  (select display_name from public.clinic_catalog_options where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  'Botox Treatment',
  'Admin can update option'
);

-- Test 8: Professional cannot update option (admin only)
set local request.jwt.claim.sub to '22222222-2222-2222-2222-222222222222';
update public.clinic_catalog_options
set is_active = false
where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
select is(
  (select is_active from public.clinic_catalog_options where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  true,
  'Professional cannot update option (admin only for updates)'
);

select * from finish();
rollback;
