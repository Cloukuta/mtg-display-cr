-- P1.4 — Instant Card Kingdom price resolution
--
-- Keep card_prices as the application's canonical runtime price table so every
-- existing surface (catalog, storefront, offers and checkout RPCs) continues to
-- use one source. When a printing enters public.cards, hydrate all of its exact
-- Card Kingdom finish/condition prices from the already-preloaded global cache.

create or replace function public.hydrate_cardkingdom_prices_from_cache(
  p_scryfall_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer := 0;
begin
  if p_scryfall_id is null then
    return 0;
  end if;

  insert into public.card_prices (
    scryfall_id,
    source,
    finish,
    condition,
    price_usd,
    updated_at
  )
  select
    cache.scryfall_id,
    'cardkingdom',
    cache.finish,
    cache.condition,
    cache.price_usd,
    cache.updated_at
  from public.cardkingdom_price_cache cache
  where cache.scryfall_id = p_scryfall_id
  on conflict (scryfall_id, source, finish, condition)
  do update set
    price_usd = excluded.price_usd,
    updated_at = excluded.updated_at;

  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

revoke all on function public.hydrate_cardkingdom_prices_from_cache(uuid) from public;
revoke all on function public.hydrate_cardkingdom_prices_from_cache(uuid) from anon;
revoke all on function public.hydrate_cardkingdom_prices_from_cache(uuid) from authenticated;

create or replace function public.cards_hydrate_cardkingdom_prices_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.hydrate_cardkingdom_prices_from_cache(new.scryfall_id);
  return new;
end;
$$;

revoke all on function public.cards_hydrate_cardkingdom_prices_trigger() from public;
revoke all on function public.cards_hydrate_cardkingdom_prices_trigger() from anon;
revoke all on function public.cards_hydrate_cardkingdom_prices_trigger() from authenticated;

drop trigger if exists trg_cards_hydrate_cardkingdom_prices on public.cards;

create trigger trg_cards_hydrate_cardkingdom_prices
after insert or update of scryfall_id
on public.cards
for each row
when (new.scryfall_id is not null)
execute function public.cards_hydrate_cardkingdom_prices_trigger();

-- Backfill every printing that already exists locally. This also repairs cards
-- added after the global cache preload but before this trigger was installed.
insert into public.card_prices (
  scryfall_id,
  source,
  finish,
  condition,
  price_usd,
  updated_at
)
select
  cache.scryfall_id,
  'cardkingdom',
  cache.finish,
  cache.condition,
  cache.price_usd,
  cache.updated_at
from public.cardkingdom_price_cache cache
join public.cards cards
  on cards.scryfall_id = cache.scryfall_id
on conflict (scryfall_id, source, finish, condition)
do update set
  price_usd = excluded.price_usd,
  updated_at = excluded.updated_at;
