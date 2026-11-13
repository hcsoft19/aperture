-- Local synthetic clinic only. Do not apply this file to a project that stores real patients.
-- Sign-in for local development: ada.clinic@example.com / local-demo-password
-- Patient account: blake.patient@example.com / local-demo-password

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  email_change_token_current,
  reauthentication_token,
  is_sso_user,
  is_anonymous
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-4111-8111-111111111111',
    'authenticated',
    'authenticated',
    'ada.clinic@example.com',
    extensions.crypt('local-demo-password', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    false,
    false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-4222-8222-222222222222',
    'authenticated',
    'authenticated',
    'blake.patient@example.com',
    extensions.crypt('local-demo-password', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    false,
    false
  );

insert into auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
values
  (
    '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111111',
    '{"sub":"11111111-1111-4111-8111-111111111111","email":"ada.clinic@example.com"}'::jsonb,
    'email',
    now(),
    now(),
    now()
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    '22222222-2222-4222-8222-222222222222',
    '{"sub":"22222222-2222-4222-8222-222222222222","email":"blake.patient@example.com"}'::jsonb,
    'email',
    now(),
    now(),
    now()
  );

update public.profiles
set full_name = 'Ada Clinic'
where id = '11111111-1111-4111-8111-111111111111';

update public.profiles
set full_name = 'Blake Patient'
where id = '22222222-2222-4222-8222-222222222222';

insert into public.organizations (id, name, created_by)
values (
  '33333333-3333-4333-8333-333333333333',
  'Example Aesthetic Studio',
  '11111111-1111-4111-8111-111111111111'
);

insert into public.organization_members (organization_id, profile_id, role)
values (
  '33333333-3333-4333-8333-333333333333',
  '11111111-1111-4111-8111-111111111111',
  'clinic_admin'
);

insert into public.patients (
  id,
  organization_id,
  first_name,
  last_name,
  contact_email
)
values (
  '44444444-4444-4444-8444-444444444444',
  '33333333-3333-4333-8333-333333333333',
  'Sam',
  'Rivera',
  'sam.rivera@example.com'
);

insert into public.patient_accounts (patient_id, profile_id)
values (
  '44444444-4444-4444-8444-444444444444',
  '22222222-2222-4222-8222-222222222222'
);

insert into public.organizations (id, name, created_by)
values (
  '55555555-5555-4555-8555-555555555555',
  'Other Clinic',
  '11111111-1111-4111-8111-111111111111'
);

insert into public.patients (
  id,
  organization_id,
  first_name,
  last_name
)
values (
  '66666666-6666-4666-8666-666666666666',
  '55555555-5555-4555-8555-555555555555',
  'Quinn',
  'Isolated'
);
