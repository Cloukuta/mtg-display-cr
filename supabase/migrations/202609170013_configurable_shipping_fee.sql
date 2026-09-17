-- MTG Display CR
-- Configurable seller shipping fee + immutable order totals.
-- Shipping defaults to CRC 600 for existing/new sellers but can be configured per seller.

alter table public.seller_pricing_settings
  add column if not exists shipping_fee_crc numeric(12,2) not null default 600;

alter table public.seller_pricing_settings
  drop constraint if exists seller_pricing_settings_shipping_fee_crc_check;

alter table public.seller_pricing_settings
  add constraint seller_pricing_settings_shipping_fee_crc_check
  check (shipping_fee_crc >= 0);

alter table public.orders
  add column if not exists subtotal_crc numeric(12,2),
  add column if not exists shipping_fee_crc numeric(12,2),
  add column if not exists total_crc numeric(12,2);

alter table public.orders
  drop constraint if exists orders_subtotal_crc_check,
  drop constraint if exists orders_shipping_fee_crc_check,
  drop constraint if exists orders_total_crc_check;

alter table public.orders
  add constraint orders_subtotal_crc_check check (subtotal_crc is null or subtotal_crc >= 0),
  add constraint orders_shipping_fee_crc_check check (shipping_fee_crc is null or shipping_fee_crc >= 0),
  add constraint orders_total_crc_check check (total_crc is null or total_crc >= 0);

create or replace function public.create_checkout_order(
  p_seller_id uuid,
  p_delivery_point_id bigint,
  p_items jsonb,
  p_customer_note text default null::text
)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_buyer_id uuid := auth.uid();
  v_order_id bigint;
  v_buyer public.profiles%rowtype;
  v_seller public.profiles%rowtype;
  v_point public.delivery_points%rowtype;
  v_item jsonb;
  v_inventory public.inventory_items%rowtype;
  v_qty integer;
  v_price_usd numeric;
  v_unit_price numeric;
  v_usd_to_crc numeric := 520;
  v_discount numeric := 20;
  v_shipping_fee numeric := 600;
  v_subtotal numeric := 0;
  v_total numeric := 0;
  v_finish text;
  v_condition text;
begin
  if v_buyer_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if v_buyer_id = p_seller_id then
    raise exception 'OWN_CATALOG';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'CART_EMPTY';
  end if;

  select * into v_buyer
  from public.profiles
  where id = v_buyer_id;

  if not found then raise exception 'BUYER_PROFILE_REQUIRED'; end if;
  if nullif(btrim(v_buyer.public_name), '') is null then raise exception 'BUYER_NAME_REQUIRED'; end if;
  if nullif(btrim(v_buyer.whatsapp), '') is null then raise exception 'BUYER_WHATSAPP_REQUIRED'; end if;

  if not exists (
    select 1 from public.profile_delivery_points x
    where x.profile_id = v_buyer_id and x.role = 'buyer_pickup'
  ) then
    raise exception 'BUYER_PICKUP_REQUIRED';
  end if;

  select * into v_seller
  from public.profiles
  where id = p_seller_id and published = true;

  if not found then raise exception 'SELLER_UNAVAILABLE'; end if;
  if nullif(btrim(v_seller.public_name), '') is null then raise exception 'SELLER_NAME_REQUIRED'; end if;
  if nullif(btrim(v_seller.whatsapp), '') is null then raise exception 'SELLER_WHATSAPP_REQUIRED'; end if;
  if nullif(btrim(v_seller.sinpe_mobile), '') is null then raise exception 'SELLER_SINPE_REQUIRED'; end if;

  if not exists (
    select 1 from public.profile_delivery_points x
    where x.profile_id = p_seller_id and x.role = 'seller_dropoff'
  ) then
    raise exception 'SELLER_DROPOFF_REQUIRED';
  end if;

  select dp.* into v_point
  from public.delivery_points dp
  where dp.id = p_delivery_point_id
    and dp.active = true
    and exists (
      select 1 from public.profile_delivery_points x
      where x.profile_id = v_buyer_id
        and x.delivery_point_id = dp.id
        and x.role = 'buyer_pickup'
    )
    and exists (
      select 1 from public.profile_delivery_points x
      where x.profile_id = p_seller_id
        and x.delivery_point_id = dp.id
        and x.role = 'seller_dropoff'
    );

  if not found then raise exception 'DELIVERY_POINT_NOT_SHARED'; end if;

  select
    coalesce(usd_to_crc, 520),
    coalesce(discount_percent, 20),
    coalesce(shipping_fee_crc, 600)
  into v_usd_to_crc, v_discount, v_shipping_fee
  from public.seller_pricing_settings
  where seller_id = p_seller_id;

  -- If the seller has no pricing-settings row yet, retain the safe defaults above.
  v_shipping_fee := greatest(coalesce(v_shipping_fee, 600), 0);

  insert into public.orders (
    seller_id,
    buyer_id,
    buyer_email,
    customer_name,
    customer_phone,
    customer_note,
    status,
    delivery_point_id,
    delivery_store_name,
    delivery_location_name,
    sinpe_phone_snapshot,
    subtotal_crc,
    shipping_fee_crc,
    total_crc,
    created_at,
    updated_at
  ) values (
    p_seller_id,
    v_buyer_id,
    auth.jwt()->>'email',
    v_buyer.public_name,
    v_buyer.whatsapp,
    nullif(btrim(p_customer_note), ''),
    'inventory_confirmation',
    v_point.id,
    v_point.store_name,
    v_point.location_name,
    v_seller.sinpe_mobile,
    0,
    v_shipping_fee,
    v_shipping_fee,
    now(),
    now()
  ) returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := greatest(0, coalesce((v_item->>'quantity')::integer, 0));
    if v_qty < 1 then raise exception 'INVALID_QUANTITY'; end if;

    select * into v_inventory
    from public.inventory_items
    where id = (v_item->>'inventory_item_id')::bigint
      and seller_id = p_seller_id
      and available = true
      and quantity >= v_qty
    for update;

    if not found then raise exception 'ITEM_UNAVAILABLE'; end if;

    v_finish := lower(regexp_replace(btrim(v_inventory.finish), '[ _-]+', '', 'g'));
    if v_finish = 'normal' then v_finish := 'nonfoil'; end if;
    v_condition := upper(btrim(v_inventory.condition));

    if v_inventory.pricing_mode = 'custom' then
      v_unit_price := v_inventory.custom_price_crc;
    else
      v_price_usd := null;

      select cp.price_usd into v_price_usd
      from public.card_prices cp
      where cp.scryfall_id = v_inventory.scryfall_id
        and cp.source = 'cardkingdom'
        and lower(regexp_replace(btrim(cp.finish), '[ _-]+', '', 'g')) = v_finish
        and upper(btrim(cp.condition)) = v_condition
      limit 1;

      if v_price_usd is null then raise exception 'PRICE_UNAVAILABLE'; end if;

      v_unit_price := round(v_price_usd * v_usd_to_crc);
      if v_inventory.pricing_mode = 'discount' then
        v_unit_price := round(v_unit_price * (1 - v_discount / 100));
      end if;
    end if;

    if v_unit_price is null then raise exception 'PRICE_UNAVAILABLE'; end if;

    insert into public.order_items (
      order_id, inventory_item_id, quantity, requested_quantity,
      unit_price_crc, pricing_mode, finish, condition, language
    ) values (
      v_order_id, v_inventory.id, v_qty, v_qty,
      v_unit_price, v_inventory.pricing_mode,
      v_inventory.finish, v_inventory.condition, v_inventory.language
    );

    v_subtotal := v_subtotal + (v_unit_price * v_qty);
  end loop;

  v_total := v_subtotal + v_shipping_fee;

  update public.orders
  set subtotal_crc = v_subtotal,
      shipping_fee_crc = v_shipping_fee,
      total_crc = v_total,
      updated_at = now()
  where id = v_order_id;

  insert into public.order_events (
    order_id, actor_id, actor_role, event_type, message
  ) values (
    v_order_id,
    v_buyer_id,
    'buyer',
    'order_created',
    'Buyer submitted checkout for seller inventory confirmation'
  );

  return v_order_id;
end;
$function$;
