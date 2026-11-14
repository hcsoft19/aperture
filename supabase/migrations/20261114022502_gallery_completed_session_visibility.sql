create or replace view public.clinic_gallery_entries with (security_invoker=true) as
select c.id,p.organization_id,'clinical'::text as entry_kind,p.id as patient_id,
 concat_ws(' ',p.first_name,p.last_name) as patient_name,p.gender as patient_gender,
 t.id as treatment_id,t.name as treatment_name,t.category,t.procedure_type,t.product_name,t.body_area,t.description as notes,
 bp.id as before_photo_id,ap.id as after_photo_id,bp.storage_path as before_path,ap.storage_path as after_path,
 bs.id as before_session_id,afs.id as after_session_id,bs.session_date as before_date,afs.session_date as after_date,
 bp.width as before_width,bp.height as before_height,ap.width as after_width,ap.height as after_height,
 ap.uploaded_at, a.name as angle_name,c.alignment,(c.shared_with_patient and c.revoked_at is null) as shared,
 '[]'::jsonb as source_credits,false as is_plate,c.created_at
from public.comparisons c join public.treatments t on t.id=c.treatment_id join public.patients p on p.id=t.patient_id
join public.photos bp on bp.id=c.before_photo_id join public.photos ap on ap.id=c.after_photo_id
join public.photo_sessions bs on bs.id=bp.session_id join public.photo_sessions afs on afs.id=ap.session_id
join public.photography_angles a on a.id=bp.angle_id
where bp.upload_status='uploaded' and ap.upload_status='uploaded' and bs.status='completed' and afs.status='completed'
union all
select d.id,d.organization_id,'demo',null::uuid,'Reference example',d.scenario_gender,
 null::uuid,d.title,d.category,d.procedure_type,d.product_name,d.body_area,d.description,
 null::uuid,null::uuid,d.before_path,d.after_path,null::uuid,null::uuid,d.before_date,d.after_date,
 d.width,d.height,d.width,d.height,d.created_at,'Published reference',jsonb_build_object('x',0,'y',0,'rotation',0,'scale',1,'aligned',false),false,
 d.source_credits,(d.after_path is null),d.created_at
from public.gallery_demo_cases d
union all
-- A completed case belongs in Home even before it has a before/after pair.
select s.id,p.organization_id,'session',p.id,concat_ws(' ',p.first_name,p.last_name),p.gender,
 t.id,t.name,t.category,t.procedure_type,t.product_name,t.body_area,t.description,
 cover.id,null::uuid,cover.storage_path,null::text,s.id,null::uuid,s.session_date,null::date,
 cover.width,cover.height,null::integer,null::integer,cover.uploaded_at,
 concat(case when s.session_type='baseline' then 'Baseline' else 'Follow-up' end,' · ',cover.angle_name),
 jsonb_build_object('x',0,'y',0,'rotation',0,'scale',1,'aligned',false),s.released_to_patient,
 '[]'::jsonb,false,s.created_at
from public.photo_sessions s join public.treatments t on t.id=s.treatment_id join public.patients p on p.id=t.patient_id
join lateral (select ph.*,a.name as angle_name from public.photos ph join public.photography_angles a on a.id=ph.angle_id where ph.session_id=s.id and ph.upload_status='uploaded' order by a.sort_order,ph.created_at,ph.id limit 1) cover on true
where s.status='completed'
 and not exists(select 1 from public.photo_sessions newer where newer.treatment_id=s.treatment_id and newer.status='completed' and exists(select 1 from public.photos x where x.session_id=newer.id and x.upload_status='uploaded') and (newer.session_date,newer.created_at,newer.id)>(s.session_date,s.created_at,s.id))
 and not exists(select 1 from public.comparisons c where c.treatment_id=t.id);

-- Completing a follow-up creates private, unaligned pairs for matching saved views.
-- Existing pairs, including withdrawn ones, are never changed or re-shared.
create function private.create_completed_session_comparisons() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.session_type<>'follow_up' or new.status<>'completed' or old.status='completed' then return new; end if;
 if auth.uid() is null then raise exception 'A signed-in professional is required'; end if;
 insert into public.comparisons(treatment_id,before_photo_id,after_photo_id,created_by,alignment)
 select new.treatment_id,b.id,a.id,auth.uid(),jsonb_build_object('x',0,'y',0,'rotation',0,'scale',1,'aligned',false)
 from public.photos a
 join lateral (
  select bp.id from public.photos bp join public.photo_sessions bs on bs.id=bp.session_id
  where bs.treatment_id=new.treatment_id and bs.session_type='baseline' and bs.status='completed'
   and bs.created_at<=new.created_at and bp.angle_id=a.angle_id and bp.upload_status='uploaded'
  order by (bp.id=a.reference_photo_id) desc nulls last,bs.session_date desc,bs.created_at desc,bp.created_at desc,bp.id desc limit 1
 ) b on true
 where a.session_id=new.id and a.upload_status='uploaded'
 and not exists(select 1 from public.comparisons c where c.before_photo_id=b.id and c.after_photo_id=a.id);
 return new;
end; $$;
revoke all on function private.create_completed_session_comparisons() from public,anon;
grant execute on function private.create_completed_session_comparisons() to authenticated;
create trigger completed_session_comparisons after update of status on public.photo_sessions for each row when(new.status='completed' and old.status<>'completed') execute function private.create_completed_session_comparisons();
