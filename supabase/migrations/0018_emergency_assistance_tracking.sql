-- Private capability-based tracking and auditable emergency assistance lifecycle.
begin;
alter table public.assistance_requests drop constraint assistance_requests_status_check;
alter table public.assistance_requests drop constraint assistance_requests_reason_check;
alter table public.assistance_requests drop constraint assistance_requests_route_kind_check;
alter table public.assistance_requests drop constraint assistance_requests_consent_version_check;
-- Replace the legacy destination constraint by discovering its generated name.
do $$ declare c record; begin
  for c in select conname from pg_constraint where conrelid='public.assistance_requests'::regclass
    and contype='c' and pg_get_constraintdef(oid) like '%destination_latitude IS NOT NULL%'
  loop execute format('alter table public.assistance_requests drop constraint %I',c.conname); end loop;
end $$;
drop trigger stamp_assistance_status on public.assistance_requests;
update public.assistance_requests set status=case status when 'NEW' then 'PENDING' when 'RESOLVED' then 'COMPLETED' else status end;
alter table public.assistance_requests alter column status set default 'PENDING';
alter table public.assistance_requests
  add constraint assistance_status_valid check(status in ('PENDING','ACKNOWLEDGED','DISPATCHED','COMPLETED','CANCELLED')),
  add constraint assistance_reason_valid check(reason in ('HAZARD_BLOCKED','EMERGENCY')),
  add constraint assistance_kind_valid check(route_kind in ('route','evacuation','emergency')),
  add constraint assistance_consent_valid check(consent_version in ('location-sharing-v1','assistance-v2')),
  add constraint assistance_destination_valid check(
    (route_kind='route' and destination_latitude is not null and destination_longitude is not null)
    or (route_kind in ('evacuation','emergency') and destination_latitude is null and destination_longitude is null)),
  add column tracking_token_hash text unique check(tracking_token_hash is null or tracking_token_hash ~ '^[0-9a-f]{64}$'),
  add column tracking_expires_at timestamptz not null default (now()+interval '7 days'),
  add column version integer not null default 1,
  add column acknowledged_at timestamptz,
  add column dispatched_at timestamptz,
  add column completed_at timestamptz,
  add column cancelled_at timestamptz;
update public.assistance_requests set status_updated_at=coalesce(status_updated_at,created_at);
create index assistance_requests_status_created_idx on public.assistance_requests(status,created_at desc);
create table public.assistance_status_history (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.assistance_requests(id) on delete cascade,
  previous_status text,
  new_status text not null,
  version integer not null,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id) on delete set null,
  actor_kind text not null check(actor_kind in ('PUBLIC_USER','CDRRMO','SYSTEM')),
  unique(request_id,version)
);
alter table public.assistance_status_history enable row level security;
revoke all on public.assistance_status_history from public,anon,authenticated;
grant select on public.assistance_status_history to authenticated;
grant all on public.assistance_status_history to service_role;
create policy assistance_history_cdrrmo_read on public.assistance_status_history for select to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='SUPER_ADMIN'));
insert into public.assistance_status_history(request_id,new_status,version,changed_at,changed_by,actor_kind)
select id,status,version,coalesce(status_updated_at,created_at),status_updated_by,'SYSTEM' from public.assistance_requests;
-- Replace broad SELECT grants: token hashes are never returned to authenticated clients.
revoke select on public.assistance_requests from authenticated;
grant select(id,latitude,longitude,accuracy_meters,location_recorded_at,display_name,contact_number,
travel_mode,route_kind,destination_latitude,destination_longitude,reason,consent_version,created_at,
status,status_updated_at,status_updated_by,version,acknowledged_at,dispatched_at,completed_at,cancelled_at)
on public.assistance_requests to authenticated;
grant update on public.assistance_requests to service_role;
create or replace function public.stamp_assistance_status() returns trigger
language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); begin
 if new.status is distinct from old.status then
  if not ((old.status='PENDING' and new.status in ('ACKNOWLEDGED','CANCELLED'))
    or (old.status='ACKNOWLEDGED' and new.status in ('DISPATCHED','CANCELLED'))
    or (old.status='DISPATCHED' and new.status in ('COMPLETED','CANCELLED'))) then
    raise exception 'Invalid assistance status transition' using errcode='23514';
  end if;
  if actor is not null and not exists(select 1 from public.profiles where id=actor and role='SUPER_ADMIN') then
    raise exception 'CDRRMO access required' using errcode='42501';
  end if;
  if actor is null and new.status<>'CANCELLED' then
    raise exception 'An authenticated CDRRMO actor is required' using errcode='42501';
  end if;
  new.version=old.version+1; new.status_updated_at=clock_timestamp(); new.status_updated_by=actor;
  if new.status='ACKNOWLEDGED' then new.acknowledged_at=new.status_updated_at; end if;
  if new.status='DISPATCHED' then new.dispatched_at=new.status_updated_at; end if;
  if new.status='COMPLETED' then new.completed_at=new.status_updated_at; end if;
  if new.status='CANCELLED' then new.cancelled_at=new.status_updated_at; end if;
 end if;
 return new;
end $$;
create trigger stamp_assistance_status before update on public.assistance_requests
for each row execute function public.stamp_assistance_status();
create function public.audit_assistance_status() returns trigger
language plpgsql security definer set search_path='' as $$ begin
 if tg_op='INSERT' then
   insert into public.assistance_status_history(request_id,new_status,version,changed_at,actor_kind)
   values(new.id,new.status,new.version,new.created_at,'PUBLIC_USER');
 elsif new.status is distinct from old.status then
   insert into public.assistance_status_history(request_id,previous_status,new_status,version,changed_at,changed_by,actor_kind)
   values(new.id,old.status,new.status,new.version,new.status_updated_at,new.status_updated_by,
     case when new.status_updated_by is null then 'PUBLIC_USER' else 'CDRRMO' end);
 end if;
 return new;
end $$;
create trigger audit_assistance_status after insert or update on public.assistance_requests
for each row execute function public.audit_assistance_status();
-- Unique UUID plus a server-derived capability make retries safe even if a response is lost.
create function public.create_tracked_assistance(p_request jsonb,p_token_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare saved public.assistance_requests; begin
 insert into public.assistance_requests(id,latitude,longitude,accuracy_meters,location_recorded_at,
 display_name,contact_number,travel_mode,route_kind,destination_latitude,destination_longitude,
 reason,consent_version,tracking_token_hash,status_updated_at)
 values((p_request->>'id')::uuid,(p_request->>'latitude')::float8,(p_request->>'longitude')::float8,
 (p_request->>'accuracy_meters')::float8,(p_request->>'location_recorded_at')::timestamptz,
 p_request->>'display_name',p_request->>'contact_number',p_request->>'travel_mode',p_request->>'route_kind',
 (p_request->>'destination_latitude')::float8,(p_request->>'destination_longitude')::float8,
 p_request->>'reason','assistance-v2',p_token_hash,now()) on conflict(id) do nothing;
 select * into saved from public.assistance_requests where id=(p_request->>'id')::uuid;
 if saved.tracking_token_hash is distinct from p_token_hash then
   raise exception 'Request ownership mismatch' using errcode='42501';
 end if;
 return to_jsonb(saved)-'tracking_token_hash';
end $$;
revoke all on function public.create_tracked_assistance(jsonb,text) from public,anon,authenticated;
grant execute on function public.create_tracked_assistance(jsonb,text) to service_role;
-- Only the backend uses this publication; public users get no anonymous SELECT policy.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(
 select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='assistance_requests') then
 alter publication supabase_realtime add table public.assistance_requests;
 end if;
end $$;
-- Operator-scheduled privacy cleanup; never callable from an anonymous browser.
create function public.purge_expired_assistance() returns bigint
language plpgsql security definer set search_path='' as $$ declare removed bigint; begin
 delete from public.assistance_requests where
 (status in ('COMPLETED','CANCELLED') and coalesce(status_updated_at,created_at)<now()-interval '30 days')
 or created_at<now()-interval '90 days';
 get diagnostics removed=row_count; return removed;
end $$;
revoke all on function public.purge_expired_assistance() from public,anon,authenticated;
grant execute on function public.purge_expired_assistance() to service_role;
commit;
