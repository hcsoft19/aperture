-- Synthetic metadata only. A patient cannot read capture guidance,
-- and a guidance row cannot store a facial template.
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
do $$
declare
  org uuid := '33333333-3333-4333-8333-333333333333';
  actor uuid := '11111111-1111-4111-8111-111111111111';
  patient uuid := gen_random_uuid();
  treatment uuid := gen_random_uuid();
  session_id uuid := gen_random_uuid();
  photo uuid := gen_random_uuid();
  protocol uuid;
  angle uuid;
begin
  select id into protocol from public.photography_protocols where code = 'FACE_STANDARD' order by version desc limit 1;
  select id into angle from public.photography_angles where protocol_id = protocol and code = 'front';
  insert into public.patients(id, organization_id, first_name, last_name) values (patient, org, 'Synthetic', 'Guidance');
  insert into public.treatments(id, patient_id, name, category, body_area, created_by, protocol_code) values (treatment, patient, 'Guidance check', 'Check', 'Face', actor, 'FACE_STANDARD');
  insert into public.photo_sessions(id, treatment_id, session_type, protocol_id, session_date, created_by) values (session_id, treatment, 'baseline', protocol, current_date, actor);
  insert into public.photos(id, session_id, angle_id, body_area, storage_path, source, captured_by, upload_status, width, height, mime_type)
    values (photo, session_id, angle, 'Face', org || '/' || patient || '/' || session_id || '/' || angle || '/' || photo || '.jpg', 'camera', actor, 'uploaded', 1200, 1600, 'image/jpeg');
  update public.photo_sessions set status = 'completed', missing_angles_reason = 'Synthetic guidance check' where id = session_id;
  insert into public.capture_quality_assessments(photo_id, session_id, schema_version, status, detector, detector_version, warnings, metrics, instruction, created_by)
    values (photo, session_id, 1, 'warning', 'none', 'none', array['detector_unavailable'], '{"faceCenterX":null}'::jsonb, 'Use the guide.', actor);
  if (select count(*) from public.capture_quality_assessments where photo_id = photo) <> 1 then
    raise exception 'Staff guidance was not saved';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.capture_quality_assessments) <> 0 then
    raise exception 'Patient can read capture guidance';
  end if;
end $$;
rollback;
