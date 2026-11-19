begin;

create or replace function public.guard_center_operations()
returns trigger language plpgsql
set search_path = public as $$
declare caller_role text; caller_barangay uuid;
begin
  if auth.uid() is not null then
    select role, barangay_id into caller_role, caller_barangay
    from public.profiles where id = auth.uid();
    if caller_role = 'BARANGAY_ADMIN' then
      if tg_op <> 'UPDATE' then
        raise exception 'Barangay accounts may only update occupancy and availability';
      end if;
      if caller_barangay is null or old.barangay_id is distinct from caller_barangay
        or new.barangay_id is distinct from caller_barangay then
        raise exception 'Center is outside the assigned barangay';
      end if;
      if (to_jsonb(new) - array['current_occupancy','status','updated_at','updated_by']) is distinct from
         (to_jsonb(old) - array['current_occupancy','status','updated_at','updated_by']) then
        raise exception 'Barangay accounts may only update occupancy and availability';
      end if;
    elsif caller_role is distinct from 'SUPER_ADMIN' then
      raise exception 'Authorized admin profile required';
    end if;
    new.updated_by = auth.uid();
  end if;

  if new.current_occupancy < 0 or new.capacity < 0 or new.current_occupancy > new.capacity then
    raise exception 'Occupancy must be between zero and capacity';
  end if;
  if new.status = 'CLOSED' or new.capacity = 0 then
    new.status = 'CLOSED';
  elsif new.current_occupancy >= new.capacity then
    new.status = 'FULL';
  elsif new.current_occupancy::numeric * 10 >= new.capacity::numeric * 7 then
    new.status = 'NEARLY_FULL';
  else
    new.status = 'AVAILABLE';
  end if;
  return new;
end;
$$;

-- Recalculate centers that were marked full by the previous 90% threshold.
update public.evacuation_centers
set status = 'AVAILABLE'
where status = 'FULL' and current_occupancy < capacity;

commit;
