-- W3.1: private in-app Wishlist availability notifications.
-- A notification is emitted only when a Wishlist item transitions from
-- no compatible stock -> compatible stock. Existing availability is seeded
-- silently so deploying this migration does not spam users.

alter table public.notifications
  add column if not exists wishlist_item_id bigint references public.wishlist_items(id) on delete set null;

create index if not exists notifications_wishlist_item_idx
  on public.notifications (wishlist_item_id, created_at desc)
  where wishlist_item_id is not null;

create table if not exists public.wishlist_availability_state (
  wishlist_item_id bigint primary key references public.wishlist_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  is_available boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists wishlist_availability_state_user_idx
  on public.wishlist_availability_state(user_id);

alter table public.wishlist_availability_state enable row level security;

drop policy if exists wishlist_availability_state_select_own on public.wishlist_availability_state;
create policy wishlist_availability_state_select_own
  on public.wishlist_availability_state
  for select
  using (auth.uid() = user_id);

-- Matching intentionally mirrors app/wishlist/page.tsx W2 compatibility rules.
create or replace function public.wishlist_item_has_stock(p_wishlist_item_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.wishlist_items w
    join public.inventory_items i
      on i.scryfall_id = w.scryfall_id
    where w.id = p_wishlist_item_id
      and i.available = true
      and i.quantity > 0
      and coalesce(i.hidden_by_reservation, false) = false
      and lower(trim(coalesce(i.finish, ''))) = lower(trim(coalesce(w.finish, '')))
      and lower(trim(coalesce(i.language, ''))) = lower(trim(coalesce(w.language, '')))
      and (
        upper(trim(coalesce(w.condition, ''))) = 'ANY'
        or lower(trim(coalesce(i.condition, ''))) = lower(trim(coalesce(w.condition, '')))
      )
  );
$$;

revoke all on function public.wishlist_item_has_stock(bigint) from public;
grant execute on function public.wishlist_item_has_stock(bigint) to authenticated;

-- Seed/refresh one Wishlist item. p_notify=false is used for initial state so
-- an item that already has stock does not create a false "new stock" alert.
create or replace function public.refresh_wishlist_availability(
  p_wishlist_item_id bigint,
  p_notify boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.wishlist_items%rowtype;
  v_previous boolean;
  v_current boolean;
begin
  select * into v_item
  from public.wishlist_items
  where id = p_wishlist_item_id;

  if not found then
    return;
  end if;

  v_current := public.wishlist_item_has_stock(v_item.id);

  select is_available into v_previous
  from public.wishlist_availability_state
  where wishlist_item_id = v_item.id;

  if not found then
    insert into public.wishlist_availability_state(wishlist_item_id, user_id, is_available, updated_at)
    values (v_item.id, v_item.user_id, v_current, now());
    return;
  end if;

  update public.wishlist_availability_state
  set is_available = v_current,
      user_id = v_item.user_id,
      updated_at = now()
  where wishlist_item_id = v_item.id;

  if p_notify
     and v_item.notify_available
     and v_previous = false
     and v_current = true then
    insert into public.notifications(user_id, wishlist_item_id, type, title, body, href)
    values (
      v_item.user_id,
      v_item.id,
      'wishlist_available',
      '¡' || v_item.name || ' ya está disponible!',
      'Una copia que coincide con tu Wishlist acaba de aparecer en MTG Display.',
      '/wishlist/' || v_item.public_id::text || '/offers'
    );
  end if;
end;
$$;

revoke all on function public.refresh_wishlist_availability(bigint, boolean) from public;

-- Re-evaluate only Wishlist rows for the printing whose inventory changed.
create or replace function public.refresh_wishlists_for_scryfall(p_scryfall_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  if p_scryfall_id is null then
    return;
  end if;

  for v_id in
    select id from public.wishlist_items where scryfall_id = p_scryfall_id
  loop
    perform public.refresh_wishlist_availability(v_id, true);
  end loop;
end;
$$;

revoke all on function public.refresh_wishlists_for_scryfall(uuid) from public;

create or replace function public.wishlist_inventory_availability_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_wishlists_for_scryfall(old.scryfall_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.scryfall_id is distinct from new.scryfall_id then
    perform public.refresh_wishlists_for_scryfall(old.scryfall_id);
  end if;

  perform public.refresh_wishlists_for_scryfall(new.scryfall_id);
  return new;
end;
$$;

drop trigger if exists wishlist_inventory_availability_change on public.inventory_items;
create trigger wishlist_inventory_availability_change
after insert or update or delete on public.inventory_items
for each row execute function public.wishlist_inventory_availability_trigger();

-- New Wishlist rows get their current state silently. Future inventory changes
-- are what generate availability notifications.
create or replace function public.wishlist_seed_availability_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_wishlist_availability(new.id, false);
  return new;
end;
$$;

drop trigger if exists wishlist_seed_availability on public.wishlist_items;
create trigger wishlist_seed_availability
after insert on public.wishlist_items
for each row execute function public.wishlist_seed_availability_trigger();

-- Seed all existing Wishlist rows without generating notifications.
insert into public.wishlist_availability_state(wishlist_item_id, user_id, is_available, updated_at)
select
  w.id,
  w.user_id,
  public.wishlist_item_has_stock(w.id),
  now()
from public.wishlist_items w
on conflict (wishlist_item_id) do update
set user_id = excluded.user_id,
    is_available = excluded.is_available,
    updated_at = excluded.updated_at;
