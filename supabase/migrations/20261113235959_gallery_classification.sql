-- Shared classification; existing patients/treatments retain their access policies.
alter table public.patients add column gender text check (gender is null or gender in ('female','male','non_binary','self_described','prefer_not_to_say'));
alter table public.treatments
  add column procedure_type text not null default '' check (char_length(procedure_type) <= 80),
  add column product_name text not null default '' check (char_length(product_name) <= 120),
  add column protocol_code text not null default 'FACE_STANDARD' check (char_length(protocol_code) <= 80);

insert into public.photography_protocols (code, version, name) values
('DENTAL_STANDARD',1,'Dental documentation'), ('BODY_STANDARD',1,'Body documentation')
on conflict (code,version) do nothing;
insert into public.photography_angles (protocol_id,code,name,sort_order,instructions)
select p.id,a.code,a.name,a.sort_order,a.instructions from public.photography_protocols p
cross join (values ('smile_front','Front smile',1,'Record a front-facing smile with consistent framing and lighting. Show the teeth without changing the image.')) a(code,name,sort_order,instructions)
where p.code='DENTAL_STANDARD' and p.version=1 on conflict (protocol_id,code) do nothing;
insert into public.photography_angles (protocol_id,code,name,sort_order,instructions)
select p.id,a.code,a.name,a.sort_order,a.instructions from public.photography_protocols p
cross join (values
('body_front','Body front',1,'Record the chosen body area from the front. Keep clothing, stance, distance and lighting consistent; include only the necessary area.'),
('body_side','Body side',2,'Record the chosen body area from the side. Match the baseline stance, clothing, framing and lighting.'),
('body_back','Body back',3,'Record the chosen body area from behind. Match baseline framing, stance, clothing and lighting.')) a(code,name,sort_order,instructions)
where p.code='BODY_STANDARD' and p.version=1 on conflict (protocol_id,code) do nothing;

-- Licensed reference demonstrations are deliberately separate from patient charts.
create table public.gallery_demo_cases (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 title text not null, category text not null, procedure_type text not null default '', product_name text not null default '', body_area text not null,
 scenario_gender text check (scenario_gender is null or scenario_gender in ('female','male','non_binary','self_described','prefer_not_to_say')),
 description text not null, before_path text not null, after_path text, before_date date not null, after_date date not null,
 width integer, height integer, source_credits jsonb not null default '[]'::jsonb check (jsonb_typeof(source_credits)='array'),
 created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(),
 constraint demo_dates check (after_date >= before_date),
 constraint demo_before_path check (before_path like organization_id::text || '/reference-demos/' || id::text || '/%'),
 constraint demo_after_path check (after_path is null or after_path like organization_id::text || '/reference-demos/' || id::text || '/%')
);
alter table public.gallery_demo_cases enable row level security;
revoke all on public.gallery_demo_cases from public,anon,authenticated;
grant select on public.gallery_demo_cases to authenticated;
create policy demo_cases_staff_select on public.gallery_demo_cases for select to authenticated using ((select private.is_org_staff(organization_id)));
create index gallery_demo_cases_org_date_idx on public.gallery_demo_cases(organization_id,created_at desc,id desc);
-- Browser uploads must match a pre-created demonstration row in the caller's clinic.
create policy demo_storage_staff_select on storage.objects for select to authenticated using (
 bucket_id='clinical-photos' and exists (select 1 from public.gallery_demo_cases d where (d.before_path=name or d.after_path=name) and (select private.is_org_staff(d.organization_id)))
);
create policy demo_storage_staff_insert on storage.objects for insert to authenticated with check (
 bucket_id='clinical-photos' and exists (select 1 from public.gallery_demo_cases d where (d.before_path=name or d.after_path=name) and (select private.is_org_staff(d.organization_id)))
);

create view public.clinic_gallery_entries with (security_invoker=true) as
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
from public.gallery_demo_cases d;
revoke all on public.clinic_gallery_entries from public,anon;
grant select on public.clinic_gallery_entries to authenticated;
create index comparisons_gallery_cursor_idx on public.comparisons(created_at desc,id desc);

create function public.clinic_gallery_facets(target_org uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'categories',coalesce(jsonb_agg(distinct category) filter(where category<>''),'[]'::jsonb),
 'procedures',coalesce(jsonb_agg(distinct procedure_type) filter(where procedure_type<>''),'[]'::jsonb),
 'products',coalesce(jsonb_agg(distinct product_name) filter(where product_name<>''),'[]'::jsonb),
 'bodyAreas',coalesce(jsonb_agg(distinct body_area) filter(where body_area<>''),'[]'::jsonb))
 from public.clinic_gallery_entries where organization_id=target_org and (select private.is_org_staff(target_org));
$$;
revoke all on function public.clinic_gallery_facets(uuid) from public,anon;
grant execute on function public.clinic_gallery_facets(uuid) to authenticated;
