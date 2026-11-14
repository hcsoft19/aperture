-- Public presentation data is isolated from clinical records and private originals.
create table public.clinic_profiles (
 organization_id uuid primary key references public.organizations(id) on delete cascade,
 slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 80),
 display_name text not null check (char_length(display_name) between 2 and 120),
 introduction text not null default '' check (char_length(introduction)<=2000),
 address text not null default '', city text not null default '', region text not null default '', postal_code text not null default '', country text not null default '',
 phone text not null default '', whatsapp text not null default '', email text not null default '', contact_name text not null default '',
 website text not null default '' check (website='' or website ~ '^https://'),
 social_links jsonb not null default '{}' check (jsonb_typeof(social_links)='object'),
 specialties text not null default '', languages text not null default '', opening_hours text not null default '',
 booking_url text not null default '' check (booking_url='' or booking_url ~ '^https://'),
 booking_label text not null default 'Book a consultation' check(char_length(booking_label) between 2 and 60),
 logo_path text, cover_path text,
 published boolean not null default false, updated_at timestamptz not null default now(),
 constraint clinic_publish_complete check (not published or (char_length(introduction)>=20 and (phone<>'' or email<>'' or website<>'' or whatsapp<>''))),
 constraint clinic_logo_path check (logo_path is null or logo_path like organization_id::text || '/branding/%'),
 constraint clinic_cover_path check (cover_path is null or cover_path like organization_id::text || '/branding/%')
);
create table public.clinic_slug_reservations (
 slug text primary key, organization_id uuid not null references public.clinic_profiles(organization_id) on delete cascade
);
create index clinic_slug_org_idx on public.clinic_slug_reservations(organization_id);
create table public.clinic_showcase_results (
 id uuid primary key, organization_id uuid not null references public.clinic_profiles(organization_id) on delete cascade,
 slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 120),
 title text not null check (char_length(title) between 3 and 120), category text not null check(char_length(category) between 1 and 80),
 procedure_type text not null default '' check(char_length(procedure_type)<=80), body_area text not null default '' check(char_length(body_area)<=80),
 summary text not null check(char_length(summary) between 20 and 2000), treatment_interval text not null default '' check(char_length(treatment_interval)<=120),
 before_path text not null, after_path text not null,
 published boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(organization_id,slug),
 constraint showcase_before_path check(before_path like organization_id::text || '/results/' || id::text || '/%'),
 constraint showcase_after_path check(after_path like organization_id::text || '/results/' || id::text || '/%')
);
create index showcase_org_created_idx on public.clinic_showcase_results(organization_id,created_at desc,id desc);
create table public.clinic_publication_permissions (
 result_id uuid primary key references public.clinic_showcase_results(id) on delete cascade,
 organization_id uuid not null references public.organizations(id), comparison_id uuid not null references public.comparisons(id),
 consent_reference text not null check(char_length(consent_reference) between 5 and 240),
 confirmed_by uuid not null references public.profiles(id), confirmed_at timestamptz not null default now(), revoked_at timestamptz
);
create index publication_permissions_org_idx on public.clinic_publication_permissions(organization_id);
create index publication_permissions_comparison_idx on public.clinic_publication_permissions(comparison_id);
create index publication_permissions_actor_idx on public.clinic_publication_permissions(confirmed_by);
alter table public.clinic_profiles enable row level security;
alter table public.clinic_slug_reservations enable row level security;
alter table public.clinic_showcase_results enable row level security;
alter table public.clinic_publication_permissions enable row level security;
revoke all on public.clinic_profiles,public.clinic_slug_reservations,public.clinic_showcase_results,public.clinic_publication_permissions from public,anon,authenticated;
grant select on public.clinic_profiles,public.clinic_slug_reservations,public.clinic_showcase_results to anon,authenticated;
grant insert,update on public.clinic_profiles,public.clinic_showcase_results to authenticated;
grant select,insert,update on public.clinic_publication_permissions to authenticated;
create policy clinic_profile_read on public.clinic_profiles for select to anon,authenticated using(published or (select private.is_org_staff(organization_id)));
create policy clinic_profile_insert on public.clinic_profiles for insert to authenticated with check((select private.is_org_admin(organization_id)));
create policy clinic_profile_update on public.clinic_profiles for update to authenticated using((select private.is_org_admin(organization_id))) with check((select private.is_org_admin(organization_id)));
create policy clinic_slug_read on public.clinic_slug_reservations for select to anon,authenticated using(exists(select 1 from public.clinic_profiles p where p.organization_id=clinic_slug_reservations.organization_id));
create policy showcase_read on public.clinic_showcase_results for select to anon,authenticated using((select private.is_org_staff(organization_id)) or (published and exists(select 1 from public.clinic_profiles p where p.organization_id=clinic_showcase_results.organization_id and p.published)));
create policy showcase_insert on public.clinic_showcase_results for insert to authenticated with check((select private.is_org_admin(organization_id)));
create policy showcase_update on public.clinic_showcase_results for update to authenticated using((select private.is_org_admin(organization_id))) with check((select private.is_org_admin(organization_id)));
create policy publication_permission_read on public.clinic_publication_permissions for select to authenticated using((select private.is_org_staff(organization_id)));
create policy publication_permission_insert on public.clinic_publication_permissions for insert to authenticated with check((select private.is_org_admin(organization_id)) and confirmed_by=(select auth.uid()));
create policy publication_permission_update on public.clinic_publication_permissions for update to authenticated using((select private.is_org_admin(organization_id))) with check((select private.is_org_admin(organization_id)) and confirmed_by=(select auth.uid()));

-- Reserve old slugs so another clinic cannot take over an existing shared link.
create function private.reserve_clinic_slug() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.is_org_admin(new.organization_id) then raise exception 'Administrator required'; end if;
 if tg_op='UPDATE' and new.organization_id<>old.organization_id then raise exception 'Clinic cannot change'; end if;
 if exists(select 1 from public.clinic_slug_reservations where slug=new.slug and organization_id<>new.organization_id) then raise exception 'Address unavailable'; end if;
 new.updated_at=now();
 return new;
end; $$;
create function private.record_clinic_slug() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.is_org_admin(new.organization_id) then raise exception 'Administrator required'; end if;
 insert into public.clinic_slug_reservations(slug,organization_id) values(new.slug,new.organization_id) on conflict(slug) do nothing;
 perform private.log_audit(new.organization_id,'clinic_profile_saved','clinic_profile',new.organization_id,jsonb_build_object('published',new.published,'slug',new.slug));
 return new;
end; $$;
create trigger clinic_profile_guard before insert or update on public.clinic_profiles for each row execute function private.reserve_clinic_slug();
create trigger clinic_profile_slug after insert or update on public.clinic_profiles for each row execute function private.record_clinic_slug();

create function private.guard_showcase() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or not private.is_org_admin(new.organization_id) then raise exception 'Administrator required'; end if;
 if tg_op='UPDATE' and (new.organization_id<>old.organization_id or new.id<>old.id or new.slug<>old.slug or new.before_path<>old.before_path or new.after_path<>old.after_path) then raise exception 'Published identity cannot change'; end if;
 if new.published and not exists(select 1 from public.clinic_publication_permissions c where c.result_id=new.id and c.organization_id=new.organization_id and c.revoked_at is null) then raise exception 'Public permission required'; end if;
 new.updated_at=now();
 perform private.log_audit(new.organization_id,case when new.published then 'showcase_published' else 'showcase_unpublished' end,'showcase_result',new.id,'{}');
 return new;
end; $$;
create trigger showcase_guard before insert or update on public.clinic_showcase_results for each row execute function private.guard_showcase();
-- A permission can only refer to a real comparison in the same clinic.
create function private.guard_publication_permission() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.comparisons c join public.treatments t on t.id=c.treatment_id join public.patients p on p.id=t.patient_id where c.id=new.comparison_id and p.organization_id=new.organization_id) then raise exception 'Comparison unavailable'; end if;
 if not exists(select 1 from public.clinic_showcase_results r where r.id=new.result_id and r.organization_id=new.organization_id) then raise exception 'Result unavailable'; end if;
 if tg_op='UPDATE' and (new.organization_id<>old.organization_id or new.comparison_id<>old.comparison_id or new.result_id<>old.result_id) then raise exception 'Permission identity cannot change'; end if;
 return new;
end; $$;
create trigger publication_permission_guard before insert or update on public.clinic_publication_permissions for each row execute function private.guard_publication_permission();
create function private.withdraw_publication() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.revoked_at is not null then update public.clinic_showcase_results set published=false where id=new.result_id; end if;
 return new;
end; $$;
create trigger publication_permission_revoke after update on public.clinic_publication_permissions for each row execute function private.withdraw_publication();

-- Atomic creation of the draft and its private permission record; publication is a separate action.
create function public.prepare_clinic_publication(payload jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare result_uuid uuid := (payload->>'id')::uuid; org uuid := (payload->>'organization_id')::uuid;
begin
 if auth.uid() is null or not private.is_org_admin(org) then raise exception 'Administrator required'; end if;
 insert into public.clinic_showcase_results(id,organization_id,slug,title,category,procedure_type,body_area,summary,treatment_interval,before_path,after_path)
 values(result_uuid,org,payload->>'slug',payload->>'title',payload->>'category',payload->>'procedure_type',payload->>'body_area',payload->>'summary',payload->>'treatment_interval',payload->>'before_path',payload->>'after_path');
 insert into public.clinic_publication_permissions(result_id,organization_id,comparison_id,consent_reference,confirmed_by)
 values(result_uuid,org,(payload->>'comparison_id')::uuid,payload->>'consent_reference',auth.uid());
 return result_uuid;
end; $$;
revoke all on function public.prepare_clinic_publication(jsonb) from public,anon;
grant execute on function public.prepare_clinic_publication(jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('clinic-showcase','clinic-showcase',false,5242880,array['image/webp']) on conflict(id) do nothing;
create policy showcase_storage_admin_read on storage.objects for select to authenticated using(bucket_id='clinic-showcase' and exists(select 1 from public.clinic_profiles p where p.organization_id::text=split_part(name,'/',1) and (select private.is_org_admin(p.organization_id))));
create policy showcase_storage_admin_insert on storage.objects for insert to authenticated with check(bucket_id='clinic-showcase' and exists(select 1 from public.clinic_profiles p where p.organization_id::text=split_part(name,'/',1) and (select private.is_org_admin(p.organization_id))));
create policy showcase_storage_admin_delete on storage.objects for delete to authenticated using(bucket_id='clinic-showcase' and exists(select 1 from public.clinic_profiles p where p.organization_id::text=split_part(name,'/',1) and (select private.is_org_admin(p.organization_id))) and not exists(select 1 from public.clinic_showcase_results r where r.published and (r.before_path=name or r.after_path=name)));
create policy showcase_storage_public_read on storage.objects for select to anon,authenticated using(bucket_id='clinic-showcase' and (
 exists(select 1 from public.clinic_profiles p where p.published and (p.logo_path=name or p.cover_path=name)) or
 exists(select 1 from public.clinic_showcase_results r join public.clinic_profiles p on p.organization_id=r.organization_id where r.published and p.published and (r.before_path=name or r.after_path=name))
));
