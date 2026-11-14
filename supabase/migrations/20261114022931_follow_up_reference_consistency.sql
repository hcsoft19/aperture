-- A follow-up draft may predate a newer baseline selected during capture.
create or replace function private.create_completed_session_comparisons() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.session_type<>'follow_up' or new.status<>'completed' or old.status='completed' then return new; end if;
 if auth.uid() is null then raise exception 'A signed-in professional is required'; end if;
 insert into public.comparisons(treatment_id,before_photo_id,after_photo_id,created_by,alignment)
 select new.treatment_id,b.id,a.id,auth.uid(),jsonb_build_object('x',0,'y',0,'rotation',0,'scale',1,'aligned',false)
 from public.photos a
 join lateral (
  select bp.id from public.photos bp join public.photo_sessions bs on bs.id=bp.session_id
  where bs.treatment_id=new.treatment_id and bs.session_type='baseline' and bs.status='completed'
   and bs.session_date<=new.session_date and bp.angle_id=a.angle_id and bp.upload_status='uploaded'
  order by (bp.id=a.reference_photo_id) desc nulls last,bs.session_date desc,bs.created_at desc,bp.created_at desc,bp.id desc limit 1
 ) b on true
 where a.session_id=new.id and a.upload_status='uploaded'
 and not exists(select 1 from public.comparisons c where c.before_photo_id=b.id and c.after_photo_id=a.id);
 return new;
end; $$;
