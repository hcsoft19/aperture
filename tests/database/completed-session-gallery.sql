-- Uses synthetic metadata in a seeded local database. No image files are created.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$
declare patient uuid:=gen_random_uuid(); treatment uuid:=gen_random_uuid(); baseline uuid:=gen_random_uuid(); followup uuid:=gen_random_uuid(); newer_baseline uuid:=gen_random_uuid(); b1 uuid:=gen_random_uuid(); b2 uuid:=gen_random_uuid(); af uuid:=gen_random_uuid(); protocol uuid; angle uuid; org uuid:='33333333-3333-4333-8333-333333333333'; actor uuid:='11111111-1111-4111-8111-111111111111';
begin
 select id into protocol from public.photography_protocols where code='BODY_STANDARD' order by version desc limit 1;
 select id into angle from public.photography_angles where protocol_id=protocol order by sort_order limit 1;
 insert into public.patients(id,organization_id,first_name,last_name) values(patient,org,'Synthetic','Workflow regression');
 insert into public.treatments(id,patient_id,name,category,body_area,created_by,protocol_code) values(treatment,patient,'Synthetic body workflow','Regression','Hands',actor,'BODY_STANDARD');
 insert into public.photo_sessions(id,treatment_id,session_type,protocol_id,session_date,created_by) values(baseline,treatment,'baseline',protocol,current_date,actor);
 insert into public.photos(id,session_id,angle_id,body_area,storage_path,source,captured_by,upload_status,width,height,mime_type) values(b1,baseline,angle,'Hands',org||'/'||patient||'/'||baseline||'/'||angle||'/'||b1||'.jpg','gallery',actor,'uploaded',1200,1600,'image/jpeg');
 update public.photo_sessions set status='completed',missing_angles_reason='Synthetic single-view regression' where id=baseline;
 if (select count(*) from public.clinic_gallery_entries where treatment_id=treatment and entry_kind='session')<>1 then raise exception 'Baseline missing from gallery'; end if;
 insert into public.photo_sessions(id,treatment_id,session_type,protocol_id,session_date,created_by,created_at) values(followup,treatment,'follow_up',protocol,current_date,actor,now()-interval '1 minute');
 insert into public.photo_sessions(id,treatment_id,session_type,protocol_id,session_date,created_by) values(newer_baseline,treatment,'baseline',protocol,current_date,actor);
 insert into public.photos(id,session_id,angle_id,body_area,storage_path,source,captured_by,upload_status,width,height,mime_type) values(b2,newer_baseline,angle,'Hands',org||'/'||patient||'/'||newer_baseline||'/'||angle||'/'||b2||'.jpg','gallery',actor,'uploaded',1200,1600,'image/jpeg');
 update public.photo_sessions set status='completed',missing_angles_reason='Synthetic single-view regression' where id=newer_baseline;
 if (select count(*) from public.clinic_gallery_entries where treatment_id=treatment)<>1 then raise exception 'Duplicate baseline cases in gallery'; end if;
 insert into public.photos(id,session_id,angle_id,body_area,storage_path,source,captured_by,upload_status,width,height,mime_type,reference_photo_id) values(af,followup,angle,'Hands',org||'/'||patient||'/'||followup||'/'||angle||'/'||af||'.jpg','gallery',actor,'uploaded',1200,1600,'image/jpeg',b2);
 update public.photo_sessions set status='completed',missing_angles_reason='Synthetic single-view regression' where id=followup;
 if (select count(*) from public.comparisons where treatment_id=treatment and before_photo_id=b2 and after_photo_id=af and not shared_with_patient and (alignment->>'aligned')::boolean=false)<>1 then raise exception 'Private comparison not generated for selected baseline'; end if;
 if (select count(*) from public.clinic_gallery_entries where treatment_id=treatment and entry_kind='clinical')<>1 then raise exception 'Completed comparison missing'; end if;
 if exists(select 1 from public.clinic_gallery_entries where treatment_id=treatment and entry_kind='session') then raise exception 'Session case duplicated completed comparison'; end if;
end $$;
rollback;
