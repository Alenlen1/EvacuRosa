-- Isolated PostgreSQL permission/transaction test. Never run against production.
\set ON_ERROR_STOP on
begin;
-- Model the standard Supabase grants in this isolated PostgreSQL fixture.
grant select on public.profiles to authenticated;
do $$ begin if current_database()<>'evacurosa_role_test' then raise exception 'Use isolated evacurosa_role_test'; end if; end $$;
insert into auth.users(id) values('10000000-0000-4000-8000-000000000051'),('10000000-0000-4000-8000-000000000052');
insert into public.profiles(id,role) values('10000000-0000-4000-8000-000000000051','SUPER_ADMIN');
insert into public.profiles(id,role,barangay_id) select '10000000-0000-4000-8000-000000000052','BARANGAY_ADMIN',id from public.barangays where name='Malusak';
create function pg_temp.denied(command text) returns void language plpgsql as $$ declare rejected boolean:=false; begin
 begin execute command; exception when insufficient_privilege or check_violation then rejected:=true; end;
 if not rejected then raise exception 'Expected access or transition denial: %',command;end if;
end $$;
set local role service_role;
select public.create_tracked_assistance('{"id":"20000000-0000-4000-8000-000000000051","latitude":14.3,"longitude":121.1,"accuracy_meters":20,"location_recorded_at":"2026-10-21T00:00:00Z","travel_mode":"walking","route_kind":"emergency","reason":"EMERGENCY"}',repeat('a',64))->>'status';
select public.create_tracked_assistance('{"id":"20000000-0000-4000-8000-000000000051","latitude":0,"longitude":0,"accuracy_meters":20,"location_recorded_at":"2026-10-21T00:00:00Z","travel_mode":"walking","route_kind":"emergency","reason":"EMERGENCY"}',repeat('a',64))->>'latitude';
select pg_temp.denied($cmd$select public.create_tracked_assistance('{"id":"20000000-0000-4000-8000-000000000051","latitude":0,"longitude":0,"accuracy_meters":20,"location_recorded_at":"2026-10-21T00:00:00Z","travel_mode":"walking","route_kind":"emergency","reason":"EMERGENCY"}',repeat('b',64))$cmd$);
reset role;
do $$ begin if (select count(*) from public.assistance_status_history where request_id='20000000-0000-4000-8000-000000000051')<>1 or
(select latitude from public.assistance_requests where id='20000000-0000-4000-8000-000000000051')<>14.3 then raise exception 'Idempotency failed';end if;end $$;
set local role anon;
select pg_temp.denied('select id from public.assistance_requests');
select pg_temp.denied('select * from public.assistance_status_history');
select pg_temp.denied($cmd$select public.create_tracked_assistance('{}','guess')$cmd$);
reset role;
set local role authenticated;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000052';
do $$ begin if (select count(id) from public.assistance_requests)<>0 or (select count(id) from public.assistance_status_history)<>0 then raise exception 'Barangay private read leak';end if;end $$;
select pg_temp.denied('select tracking_token_hash from public.assistance_requests');
select pg_temp.denied($cmd$select public.create_tracked_assistance('{}','guess')$cmd$);
update public.assistance_requests set status='ACKNOWLEDGED' where id='20000000-0000-4000-8000-000000000051';
reset role;
do $$ begin if (select status from public.assistance_requests where id='20000000-0000-4000-8000-000000000051')<>'PENDING' then raise exception 'Barangay update leak';end if;end $$;
set local role authenticated;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000051';
select pg_temp.denied('select tracking_token_hash from public.assistance_requests');
select pg_temp.denied($cmd$update public.assistance_requests set status='DISPATCHED' where id='20000000-0000-4000-8000-000000000051'$cmd$);
update public.assistance_requests set status='ACKNOWLEDGED' where id='20000000-0000-4000-8000-000000000051' and version=1;
update public.assistance_requests set status='CANCELLED' where id='20000000-0000-4000-8000-000000000051' and version=1;
do $$ begin if (select status from public.assistance_requests where id='20000000-0000-4000-8000-000000000051')<>'ACKNOWLEDGED' then raise exception 'Stale mutation won';end if;end $$;
update public.assistance_requests set status='DISPATCHED' where id='20000000-0000-4000-8000-000000000051' and version=2;
update public.assistance_requests set status='COMPLETED' where id='20000000-0000-4000-8000-000000000051' and version=3;
select pg_temp.denied($cmd$update public.assistance_requests set status='CANCELLED' where id='20000000-0000-4000-8000-000000000051'$cmd$);
reset role;
do $$ begin
 if (select count(*) from public.assistance_status_history where request_id='20000000-0000-4000-8000-000000000051')<>4 then raise exception 'Audit count mismatch';end if;
 if (select count(*) from public.assistance_status_history where request_id='20000000-0000-4000-8000-000000000051' and changed_by='10000000-0000-4000-8000-000000000051')<>3 then raise exception 'Actor missing';end if;
 if (select version=4 and acknowledged_at is not null and dispatched_at is not null and completed_at is not null from public.assistance_requests where id='20000000-0000-4000-8000-000000000051') is not true then raise exception 'Status timestamps/version missing';end if;
end $$;
-- A requester cancellation runs only after backend capability validation.
set local request.jwt.claim.sub='';
set local role service_role;
select public.create_tracked_assistance('{"id":"20000000-0000-4000-8000-000000000052","latitude":14.3,"longitude":121.1,"accuracy_meters":20,"location_recorded_at":"2026-10-21T00:00:00Z","travel_mode":"walking","route_kind":"emergency","reason":"EMERGENCY"}',repeat('c',64))->>'status';
update public.assistance_requests set status='CANCELLED' where id='20000000-0000-4000-8000-000000000052';
reset role;
do $$ begin if (select count(*) from public.assistance_status_history where request_id='20000000-0000-4000-8000-000000000052' and new_status='CANCELLED' and actor_kind='PUBLIC_USER')<>1 then raise exception 'Owner cancellation missing';end if;end $$;
-- Retention cleanup removes expired closed data and all data older than 90 days.
insert into public.assistance_requests(id,latitude,longitude,accuracy_meters,location_recorded_at,
travel_mode,route_kind,reason,consent_version,status,created_at,status_updated_at) values
('20000000-0000-4000-8000-000000000053',14.3,121.1,20,now(),'walking','emergency','EMERGENCY','assistance-v2','COMPLETED',now()-interval '40 days',now()-interval '31 days'),
('20000000-0000-4000-8000-000000000054',14.3,121.1,20,now(),'walking','emergency','EMERGENCY','assistance-v2','PENDING',now()-interval '91 days',now()-interval '91 days');
select public.purge_expired_assistance();
do $$ begin if exists(select 1 from public.assistance_requests where id in ('20000000-0000-4000-8000-000000000053','20000000-0000-4000-8000-000000000054'))
or exists(select 1 from public.assistance_status_history where request_id in ('20000000-0000-4000-8000-000000000053','20000000-0000-4000-8000-000000000054')) then raise exception 'Retention cleanup failed';end if;end $$;
rollback;
\echo 'PASS: assistance privacy, role restrictions, idempotency, transition guards, optimistic concurrency and transactional actor history.'
