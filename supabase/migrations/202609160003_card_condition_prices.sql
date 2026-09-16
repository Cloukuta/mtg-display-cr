-- MTG Display CR
-- Condition-aware market pricing foundation

create table if not exists public.card_prices (
  id bigint generated always as identity primary key,
  scryfall_id uuid not null references public.cards(scryfall_id) on delete cascade,
  source text not null,
  finish text not null,
  condition text not null,
  price_usd numeric(10,2) not null check (price_usd >= 0),
  updated_at timestamptz not null default now(),

  constraint card_prices_source_check
    check (source in ('cardkingdom')),
  constraint card_prices_finish_check
    check (finish in ('nonfoil', 'foil', 'etched', 'surgefoil')),
  constraint card_prices_condition_check
    check (condition in ('NM', 'EX', 'VG', 'G', 'PL', 'PO')),
  constraint card_prices_unique_market_price
    unique (scryfall_id, source, finish, condition)
);

create index if not exists card_prices_lookup_idx
  on public.card_prices (scryfall_id, source, finish, condition);

alter table public.card_prices enable row level security;

-- A price can be read when the card is visible in a published catalog or
-- belongs to the currently authenticated seller's inventory.
create policy "card prices catalog read"
on public.card_prices
for select
using (
  exists (
    select 1
    from public.inventory_items i
    join public.profiles p on p.id = i.seller_id
    where i.scryfall_id = card_prices.scryfall_id
      and (
        (i.available and i.quantity > 0 and p.published)
        or i.seller_id = auth.uid()
      )
  )
);

-- Writes are intentionally not granted to normal users. The daily backend
-- synchronization uses the Supabase service role.
