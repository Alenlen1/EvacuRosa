-- Run only against an isolated migration-test database, never production.
\set ON_ERROR_STOP on
begin;
do $$ begin if current_database() <> 'evacurosa_role_test' then raise exception 'Use the isolated evacurosa_role_test database'; end if; end $$;
-- Model the standard Supabase grants in the local PostgreSQL test fixture.
grant usage on schema public, auth to authenticated, anon;
grant select on public.barangays, public.evacuation_centers, public.profiles to authenticated;
grant select on public.barangays, public.evacuation_centers to anon;
grant insert, update, delete on public.evacuation_centers to authenticated;
insert into auth.users(id) values ('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002'),('10000000-0000-4000-8000-000000000003'),('10000000-0000-4000-8000-000000000004');
insert into public.profiles(id,role,barangay_id) select '10000000-0000-4000-8000-000000000001','BARANGAY_ADMIN',id from public.barangays where name='Malusak';
insert into public.profiles(id,role,barangay_id) select '10000000-0000-4000-8000-000000000002','BARANGAY_ADMIN',id from public.barangays where name='Aplaya';
insert into public.profiles(id,role) values ('10000000-0000-4000-8000-000000000003','SUPER_ADMIN');
-- Simulate a legacy citywide barangay account retained by the NOT VALID check.
alter table public.profiles drop constraint barangay_admin_requires_assignment;
insert into public.profiles(id,role) values ('10000000-0000-4000-8000-000000000004','BARANGAY_ADMIN');
alter table public.profiles add constraint barangay_admin_requires_assignment check(role <> 'BARANGAY_ADMIN' or barangay_id is not null) not valid;
insert into public.evacuation_centers(id,barangay_id,name,address,latitude,longitude,capacity) select '20000000-0000-4000-8000-000000000001',id,'Test A','Test address',14.31427,121.112691,100 from public.barangays where name='Malusak';
insert into public.evacuation_centers(id,barangay_id,name,address,latitude,longitude,capacity) select '20000000-0000-4000-8000-000000000002',id,'Test B','Test address',14.31427,121.112691,100 from public.barangays where name='Aplaya';
create function pg_temp.denied(command text) returns void language plpgsql as $$
declare blocked boolean := false;
begin begin execute command; exception when insufficient_privilege or raise_exception then blocked := true; end;
if not blocked then raise exception 'Expected denial: %', command; end if; end $$;
set local role authenticated;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
update public.evacuation_centers set current_occupancy=80 where id='20000000-0000-4000-8000-000000000001';
do $$ begin if (select status from public.evacuation_centers where id='20000000-0000-4000-8000-000000000001') <> 'NEARLY_FULL' then raise exception 'Wrong threshold'; end if; end $$;
select pg_temp.denied($q$update public.evacuation_centers set capacity=200 where id='20000000-0000-4000-8000-000000000001'$q$);
select pg_temp.denied($q$update public.evacuation_centers set name='Forged' where id='20000000-0000-4000-8000-000000000001'$q$);
select pg_temp.denied($q$update public.evacuation_centers set water_status='adequate' where id='20000000-0000-4000-8000-000000000001'$q$);
select pg_temp.denied($q$update public.evacuation_centers set barangay_id=(select id from public.barangays where name='Aplaya') where id='20000000-0000-4000-8000-000000000001'$q$);
select pg_temp.denied($q$update public.evacuation_centers set current_occupancy=101 where id='20000000-0000-4000-8000-000000000001'$q$);
select pg_temp.denied($q$select * from public.barangay_access_accounts$q$);
select pg_temp.denied($q$update public.profiles set role='SUPER_ADMIN' where id='10000000-0000-4000-8000-000000000001'$q$);
select pg_temp.denied($q$insert into public.evacuation_centers(name,address,latitude,longitude,capacity) values ('Forbidden','Test',14.31,121.11,100)$q$);
do $$ declare changed int; begin
 update public.evacuation_centers set current_occupancy=2 where id='20000000-0000-4000-8000-000000000002'; get diagnostics changed=row_count; if changed<>0 then raise exception 'Cross-barangay write'; end if;
 delete from public.evacuation_centers where id='20000000-0000-4000-8000-000000000001';get diagnostics changed=row_count;if changed<>0 then raise exception 'Barangay delete';end if;
end $$;
update public.evacuation_centers set status='CLOSED' where id='20000000-0000-4000-8000-000000000001';
update public.evacuation_centers set status='AVAILABLE',current_occupancy=95 where id='20000000-0000-4000-8000-000000000001';
do $$ begin if (select status from public.evacuation_centers where id='20000000-0000-4000-8000-000000000001') <> 'FULL' then raise exception 'Full center reopened';end if;end $$;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000004';
do $$ declare changed int;begin update public.evacuation_centers set current_occupancy=1;get diagnostics changed=row_count;if changed<>0 then raise exception 'Legacy citywide access';end if;end $$;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000003';
insert into public.evacuation_centers(id,barangay_id,name,address,latitude,longitude,capacity) select '20000000-0000-4000-8000-000000000003',id,'CDRRMO registration','Test',14.31427,121.112691,100 from public.barangays where name='Malusak';
update public.evacuation_centers set name='CDRRMO edited',barangay_id=(select id from public.barangays where name='Aplaya') where id='20000000-0000-4000-8000-000000000003';
delete from public.evacuation_centers where id='20000000-0000-4000-8000-000000000003';
reset role;
do $$ begin if (select current_occupancy from public.evacuation_centers where id='20000000-0000-4000-8000-000000000002') <> 0 then raise exception 'Cross-barangay write persisted';end if;end $$;
rollback;
\echo PASS: scoped updates, field guards, account protection, availability, legacy denial, CDRRMO CRUD
