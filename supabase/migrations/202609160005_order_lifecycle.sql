-- MTG Display CR
-- Full buyer/seller order lifecycle + SINPE + Red de Envios foundation

-- Extend profiles so one account can buy and sell.
alter table public.profiles
  add column if not exists whatsapp_phone text,
  add column if not exists sinpe_phone text,
  add column if not exists sinpe_holder_name text,
  add column if not exists accepts_sinpe boolean not null default false;

-- Partner stores and their Red de Envios locations.
create table if not exists public.partner_stores (
  id bigint generated always as identity primary key,
  name text not null unique,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.partner_store_locations (
  id bigint generated always as identity primary key,
  store_id bigint not null references public.partner_stores(id) on delete cascade,
  location_name text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (store_id, location_name)
);

create table if not exists public.seller_delivery_locations (
  seller_id uuid not null references public.profiles(id) on delete cascade,
  location_id bigint not null references public.partner_store_locations(id) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (seller_id, location_id)
);

alter table public.partner_stores enable row level security;
alter table public.partner_store_locations enable row level security;
alter table public.seller_delivery_locations enable row level security;

create policy "partner stores are publicly readable" on public.partner_stores for select using (active = true);
create policy "partner locations are publicly readable" on public.partner_store_locations for select using (active = true);
create policy "seller manages own delivery locations" on public.seller_delivery_locations for all using (seller_id = auth.uid()) with check (seller_id = auth.uid());
create policy "enabled seller delivery locations are publicly readable" on public.seller_delivery_locations for select using (enabled = true);

-- Seed the initial Red de Envios supplied for the project.
insert into public.partner_stores (name, sort_order) values
  ('Duelist Kingdom', 10), ('Perron Store', 20), ('Dice & Cards', 30),
  ('Mystica', 40), ('Velvet Game Store', 50), ('Raven House', 60),
  ('Astro City', 70), ('Lilith''s Den', 80), ('Fenix Tienda', 90),
  ('Pinky Singles', 100), ('TCG World', 110), ('Burro Singles', 120),
  ('Bluff Store', 130), ('Kira Shop', 140), ('Olympus Garden', 150),
  ('Ruta 5', 160), ('Zeus Hobby Store', 170), ('Imperium Hobby Shop', 180),
  ('Santuario Geek', 190), ('Krypton Hobby Store', 200), ('Trinity TCG', 210),
  ('Arlreyy TCG Center', 220)
on conflict (name) do update set active = true, sort_order = excluded.sort_order;

with locations(store_name, location_name, sort_order) as (values
  ('Duelist Kingdom','Alajuela',10),
  ('Duelist Kingdom','San Pedro y Zapote',20), ('Perron Store','San Pedro y Zapote',30), ('Dice & Cards','San Pedro y Zapote',40),
  ('Mystica','Palmares',50), ('Mystica','San Ramón',60), ('Velvet Game Store','Palmares y San Ramón',70),
  ('Raven House','Heredia',80), ('Astro City','Heredia',90), ('Lilith''s Den','Heredia',100),
  ('Fenix Tienda','Guadalupe',110), ('Pinky Singles','Guadalupe',120), ('TCG World','Guadalupe',130),
  ('Duelist Kingdom','Belén',140), ('Burro Singles','Belén',150),
  ('Bluff Store','San José',160), ('Kira Shop','San José',170),
  ('Olympus Garden','Calle Blancos',180), ('Ruta 5','Liberia',190),
  ('Zeus Hobby Store','Cartago',200), ('Imperium Hobby Shop','Cartago',210),
  ('Santuario Geek','Turrialba',220), ('Krypton Hobby Store','Coronado',230),
  ('Trinity TCG','Moravia',240), ('Arlreyy TCG Center','San Carlos',250)
)
insert into public.partner_store_locations (store_id, location_name, sort_order)
select s.id, l.location_name, l.sort_order
from locations l join public.partner_stores s on s.name = l.store_name
on conflict (store_id, location_name) do update set active = true, sort_order = excluded.sort_order;

-- Expand orders from the initial pending/completed/cancelled model.
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders
  add constraint orders_status_check check (status in (
    'inventory_confirmation',
    'payment_pending',
    'paid',
    'preparing_shipment',
    'shipped',
    'completed',
    'cancelled'
  ));

alter table public.orders alter column status set default 'inventory_confirmation';

alter table public.orders
  add column if not exists buyer_id uuid references public.profiles(id) on delete set null,
  add column if not exists buyer_email text,
  add column if not exists delivery_location_id bigint references public.partner_store_locations(id) on delete set null,
  add column if not exists delivery_store_name text,
  add column if not exists delivery_location_name text,
  add column if not exists sinpe_phone_snapshot text,
  add column if not exists sinpe_holder_snapshot text,
  add column if not exists inventory_confirmed_at timestamptz,
  add column if not exists payment_confirmed_at timestamptz,
  add column if not exists shipped_at timestamptz;

-- Existing test pending orders become inventory-confirmation orders.
update public.orders set status = 'inventory_confirmation' where status = 'pending';

create index if not exists orders_buyer_status_idx on public.orders (buyer_id, status, created_at desc);

-- Buyer may read their own order. Seller policies from the previous migration remain.
create policy "buyer reads own orders" on public.orders for select using (buyer_id = auth.uid());
create policy "buyer reads own order items" on public.order_items for select using (
  exists (select 1 from public.orders o where o.id = order_items.order_id and o.buyer_id = auth.uid())
);

-- Immutable-ish timeline for buyer/seller visibility and future disputes.
create table if not exists public.order_events (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_role text not null check (actor_role in ('buyer','seller','system')),
  event_type text not null,
  message text,
  created_at timestamptz not null default now()
);
create index if not exists order_events_order_idx on public.order_events(order_id, created_at);
alter table public.order_events enable row level security;
create policy "participants read order events" on public.order_events for select using (
  exists (select 1 from public.orders o where o.id = order_events.order_id and (o.seller_id = auth.uid() or o.buyer_id = auth.uid()))
);
create policy "seller adds order events" on public.order_events for insert with check (
  actor_id = auth.uid() and exists (select 1 from public.orders o where o.id = order_events.order_id and o.seller_id = auth.uid())
);

-- Shipment evidence: only the envelope/package image belongs here. Payment receipts stay on WhatsApp.
create table if not exists public.shipment_evidence (
  id bigint generated always as identity primary key,
  order_id bigint not null unique references public.orders(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  evidence_method text not null check (evidence_method in ('upload','whatsapp')),
  storage_path text,
  whatsapp_confirmed_at timestamptz,
  uploaded_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (evidence_method = 'upload' and storage_path is not null and uploaded_at is not null and expires_at is not null)
    or
    (evidence_method = 'whatsapp' and storage_path is null and whatsapp_confirmed_at is not null)
  )
);
alter table public.shipment_evidence enable row level security;
create policy "seller manages shipment evidence" on public.shipment_evidence for all using (seller_id = auth.uid()) with check (seller_id = auth.uid());
create policy "buyer reads shipment evidence metadata" on public.shipment_evidence for select using (
  exists (select 1 from public.orders o where o.id = shipment_evidence.order_id and o.buyer_id = auth.uid())
);

-- Storage bucket for temporary envelope/package evidence. Files are private.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shipment-evidence', 'shipment-evidence', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "seller uploads shipment evidence files" on storage.objects for insert to authenticated
with check (bucket_id = 'shipment-evidence' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "seller reads own shipment evidence files" on storage.objects for select to authenticated
using (bucket_id = 'shipment-evidence' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "seller deletes own shipment evidence files" on storage.objects for delete to authenticated
using (bucket_id = 'shipment-evidence' and (storage.foldername(name))[1] = auth.uid()::text);

-- IMPORTANT: automatic physical deletion after 21 days will be handled by a scheduled
-- server-side cleanup job/Edge Function. expires_at is stored now so the policy is deterministic.
