-- Keep existing storefront queries safe while Checkout v2 reservations are active.
-- inventory_items.quantity remains PHYSICAL stock. We only hide an item from the
-- current storefront queries when all physical copies are covered by active reservations.

alter table public.inventory_items
  add column if not exists hidden_by_reservation boolean not null default false;

create or replace function public.refresh_inventory_reservation_visibility(p_inventory_item_id bigint)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_physical integer;
  v_reserved integer;
  v_available boolean;
  v_hidden boolean;
begin
  select quantity, available, hidden_by_reservation
    into v_physical, v_available, v_hidden
  from public.inventory_items
  where id=p_inventory_item_id
  for update;

  if not found then return; end if;

  select coalesce(sum(quantity),0)::integer
    into v_reserved
  from public.inventory_reservations
  where inventory_item_id=p_inventory_item_id
    and status='active';

  -- Fully reserved: hide only inventory that was otherwise published/available.
  if greatest(v_physical-v_reserved,0)=0 then
    if v_available then
      update public.inventory_items
      set available=false,
          hidden_by_reservation=true,
          updated_at=now()
      where id=p_inventory_item_id;
    end if;
    return;
  end if;

  -- Reservation was released/reduced: restore only rows that this reservation
  -- mechanism previously hid. Do not blindly publish arbitrary seller inventory.
  if v_hidden then
    update public.inventory_items
    set available=true,
        hidden_by_reservation=false,
        updated_at=now()
    where id=p_inventory_item_id;
  end if;
end;
$$;

create or replace function public.sync_inventory_reservation_visibility()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if tg_op='DELETE' then
    perform public.refresh_inventory_reservation_visibility(old.inventory_item_id);
    return old;
  end if;

  perform public.refresh_inventory_reservation_visibility(new.inventory_item_id);
  if tg_op='UPDATE' and old.inventory_item_id is distinct from new.inventory_item_id then
    perform public.refresh_inventory_reservation_visibility(old.inventory_item_id);
  end if;
  return new;
end;
$$;

drop trigger if exists inventory_reservation_visibility_trigger on public.inventory_reservations;
create trigger inventory_reservation_visibility_trigger
after insert or update or delete on public.inventory_reservations
for each row execute function public.sync_inventory_reservation_visibility();

-- Backfill visibility for reservations that already existed before this migration
-- (including the current staging test order).
do $$
declare r record;
begin
  for r in select distinct inventory_item_id from public.inventory_reservations loop
    perform public.refresh_inventory_reservation_visibility(r.inventory_item_id);
  end loop;
end $$;

-- Keep the canonical availability helper as the source of truth for exact quantities.
-- Current storefronts use inventory_items.available; a later UI pass can surface
-- partial reservation counts directly via inventory_available_quantity().
