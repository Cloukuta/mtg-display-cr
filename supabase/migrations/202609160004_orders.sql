-- MTG Display CR
-- Pending sales / order management foundation

create table if not exists public.orders (
  id bigint generated always as identity primary key,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  customer_name text,
  customer_phone text,
  customer_note text,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz
);

create index if not exists orders_seller_status_idx
  on public.orders (seller_id, status, created_at desc);

create table if not exists public.order_items (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders(id) on delete cascade,
  inventory_item_id bigint not null references public.inventory_items(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  requested_quantity integer not null check (requested_quantity > 0),
  unit_price_crc numeric(12,2) not null check (unit_price_crc >= 0),
  pricing_mode text not null check (pricing_mode in ('default', 'custom', 'discount')),
  finish text not null,
  condition text not null,
  language text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, inventory_item_id)
);

create index if not exists order_items_order_idx on public.order_items(order_id);
create index if not exists order_items_inventory_idx on public.order_items(inventory_item_id);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "seller manages own orders"
on public.orders
for all
using (seller_id = auth.uid())
with check (seller_id = auth.uid());

create policy "seller manages own order items"
on public.order_items
for all
using (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and o.seller_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and o.seller_id = auth.uid()
  )
);

-- Public checkout creation will be added later through a controlled backend/RPC.
-- Do not grant anonymous direct INSERT access to orders/order_items.
