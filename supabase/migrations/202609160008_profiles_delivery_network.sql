-- Profile checkout data + structured Red de Envios support.
-- This migration is intentionally additive so the current public catalog keeps working.

alter table public.profiles
  add column if not exists sinpe_mobile text not null default '';

alter table public.profiles
  drop constraint if exists profiles_sinpe_mobile_format;

alter table public.profiles
  add constraint profiles_sinpe_mobile_format
  check (sinpe_mobile = '' or sinpe_mobile ~ '^[0-9]{8,15}$');

create table if not exists public.delivery_points (
  id bigint generated always as identity primary key,
  network text not null default 'red_de_envios',
  location_name text not null,
  store_name text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_points_network_check check (network in ('red_de_envios')),
  unique (network, location_name, store_name)
);

create table if not exists public.profile_delivery_points (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  delivery_point_id bigint not null references public.delivery_points(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, delivery_point_id, role),
  constraint profile_delivery_points_role_check check (role in ('buyer_pickup','seller_dropoff'))
);

create index if not exists profile_delivery_points_profile_idx
  on public.profile_delivery_points(profile_id);
create index if not exists profile_delivery_points_point_idx
  on public.profile_delivery_points(delivery_point_id);

alter table public.delivery_points enable row level security;
alter table public.profile_delivery_points enable row level security;

-- The admitted Red de Envios directory is public reference data.
create policy "delivery points public read"
  on public.delivery_points for select
  using (active = true);

-- Users can only see and maintain their own pickup/dropoff preferences.
create policy "profile delivery points owner read"
  on public.profile_delivery_points for select
  using (profile_id = auth.uid());
create policy "profile delivery points owner insert"
  on public.profile_delivery_points for insert
  with check (profile_id = auth.uid());
create policy "profile delivery points owner update"
  on public.profile_delivery_points for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
create policy "profile delivery points owner delete"
  on public.profile_delivery_points for delete
  using (profile_id = auth.uid());

-- Checkout helper: returns only active points supported by both buyer and seller.
create or replace function public.get_shared_delivery_points(
  buyer_profile_id uuid,
  seller_profile_id uuid
)
returns table (
  id bigint,
  network text,
  location_name text,
  store_name text
)
language sql
stable
security invoker
set search_path = public
as $$
  select dp.id, dp.network, dp.location_name, dp.store_name
  from public.delivery_points dp
  join public.profile_delivery_points buyer
    on buyer.delivery_point_id = dp.id
   and buyer.profile_id = buyer_profile_id
   and buyer.role = 'buyer_pickup'
  join public.profile_delivery_points seller
    on seller.delivery_point_id = dp.id
   and seller.profile_id = seller_profile_id
   and seller.role = 'seller_dropoff'
  where dp.active = true
  order by dp.sort_order, dp.location_name, dp.store_name;
$$;

-- Store seeds are deliberately kept separate from the schema migration.
-- We will insert the exact admitted Red de Envios list after verifying the
-- location/store pairs from the supplied reference image, avoiding guessed data.
