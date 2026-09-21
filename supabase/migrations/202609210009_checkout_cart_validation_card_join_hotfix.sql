-- Checkout v2 hotfix: validate_checkout_cart must join cards through scryfall_id.
-- inventory_items references cards(scryfall_id); there is no cards.id / inventory_items.card_id relationship.

drop function if exists public.validate_checkout_cart(uuid,jsonb);

create function public.validate_checkout_cart(
  p_seller_id uuid,
  p_items jsonb
)
returns table (
  inventory_item_id bigint,
  requested_quantity integer,
  available_quantity integer,
  action text,
  card_name text,
  set_code text,
  collector_number text,
  finish text,
  condition text
)
language plpgsql
security definer
set search_path=public
as $$
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'INVALID_CART';
  end if;

  return query
  with requested as (
    select
      (x->>'inventory_item_id')::bigint as item_id,
      greatest(coalesce((x->>'quantity')::integer,0),0) as qty
    from jsonb_array_elements(p_items) x
  ), resolved as (
    select
      r.item_id,
      r.qty,
      i.id as existing_item_id,
      coalesce(public.inventory_available_quantity(i.id),0) as sellable,
      c.name,
      c.set_code,
      c.collector_number,
      i.finish,
      i.condition
    from requested r
    left join public.inventory_items i
      on i.id=r.item_id and i.seller_id=p_seller_id
    left join public.cards c
      on c.scryfall_id=i.scryfall_id
  )
  select
    x.item_id,
    x.qty,
    case when x.existing_item_id is null then 0 else x.sellable end,
    case
      when x.existing_item_id is null then 'remove'
      when x.sellable <= 0 then 'remove'
      when x.qty > x.sellable then 'reduce'
      else 'ok'
    end,
    x.name,
    x.set_code,
    x.collector_number,
    x.finish,
    x.condition
  from resolved x
  order by x.item_id;
end;
$$;

grant execute on function public.validate_checkout_cart(uuid,jsonb) to anon, authenticated;

comment on function public.validate_checkout_cart(uuid,jsonb) is
'Checkout v2 preflight. Exact inventory identity is inventory_item_id; card metadata is joined by scryfall_id. action=remove removes an unavailable exact variant; action=reduce clamps quantity; action=ok leaves the cart line unchanged.';
