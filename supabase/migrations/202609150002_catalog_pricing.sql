-- MTG Display CR
-- Catalog & Pricing foundation

create table if not exists public.seller_pricing_settings (
  seller_id uuid primary key
    references public.profiles(id) on delete cascade,

  usd_to_crc numeric(10,2) not null default 520
    check (usd_to_crc > 0),

  discount_percent numeric(5,2) not null default 20
    check (discount_percent >= 0 and discount_percent <= 100),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.seller_pricing_settings
enable row level security;

create policy "pricing settings owner select"
on public.seller_pricing_settings
for select
using (seller_id = auth.uid());

create policy "pricing settings owner insert"
on public.seller_pricing_settings
for insert
with check (seller_id = auth.uid());

create policy "pricing settings owner update"
on public.seller_pricing_settings
for update
using (seller_id = auth.uid())
with check (seller_id = auth.uid());


alter table public.cards
add column if not exists cardkingdom_price_usd numeric(10,2);

alter table public.cards
add column if not exists cardkingdom_price_updated_at timestamptz;


alter table public.inventory_items
add column if not exists pricing_mode text not null default 'default';

alter table public.inventory_items
add column if not exists custom_price_crc integer;

alter table public.inventory_items
add constraint inventory_items_pricing_mode_check
check (pricing_mode in ('default', 'custom', 'discount'));

alter table public.inventory_items
add constraint inventory_items_custom_price_check
check (
  custom_price_crc is null
  or custom_price_crc >= 0
);


insert into public.seller_pricing_settings (
  seller_id,
  usd_to_crc,
  discount_percent
)
select
  id,
  520,
  20
from public.profiles
on conflict (seller_id) do nothing;