-- MTG Display CR
-- Authenticated checkout using the current delivery_points/profile_delivery_points model.
-- Prices, identity, profile completeness and stock are validated server-side.

alter table public.orders
  add column if not exists delivery_point_id bigint references public.delivery_points(id) on delete set null;

create or replace function public.create_checkout_order(
  p_seller_id uuid,
  p_delivery_point_id bigint,
  p_items jsonb,
  p_customer_note text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
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
  v_finish text;
  v_condition text;
begin
  if v_buyer_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_buyer_id = p_seller_id then raise exception 'OWN_CATALOG'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'CART_EMPTY'; end if;

  select * into v_buyer from public.profiles where id=v_buyer_id;
  if not found then raise exception 'BUYER_PROFILE_REQUIRED'; end if;
  if nullif(btrim(v_buyer.public_name),'') is null then raise exception 'BUYER_NAME_REQUIRED'; end if;
  if nullif(btrim(v_buyer.whatsapp),'') is null then raise exception 'BUYER_WHATSAPP_REQUIRED'; end if;
  if not exists(select 1 from public.profile_delivery_points x where x.profile_id=v_buyer_id and x.role='buyer_pickup') then raise exception 'BUYER_PICKUP_REQUIRED'; end if;

  select * into v_seller from public.profiles where id=p_seller_id and published=true;
  if not found then raise exception 'SELLER_UNAVAILABLE'; end if;
  if nullif(btrim(v_seller.public_name),'') is null then raise exception 'SELLER_NAME_REQUIRED'; end if;
  if nullif(btrim(v_seller.whatsapp),'') is null then raise exception 'SELLER_WHATSAPP_REQUIRED'; end if;
  if nullif(btrim(v_seller.sinpe_mobile),'') is null then raise exception 'SELLER_SINPE_REQUIRED'; end if;
  if not exists(select 1 from public.profile_delivery_points x where x.profile_id=p_seller_id and x.role='seller_dropoff') then raise exception 'SELLER_DROPOFF_REQUIRED'; end if;

  select dp.* into v_point from public.delivery_points dp
  where dp.id=p_delivery_point_id and dp.active=true
    and exists(select 1 from public.profile_delivery_points x where x.profile_id=v_buyer_id and x.delivery_point_id=dp.id and x.role='buyer_pickup')
    and exists(select 1 from public.profile_delivery_points x where x.profile_id=p_seller_id and x.delivery_point_id=dp.id and x.role='seller_dropoff');
  if not found then raise exception 'DELIVERY_POINT_NOT_SHARED'; end if;

  select coalesce(usd_to_crc,520),coalesce(discount_percent,20) into v_usd_to_crc,v_discount
  from public.seller_pricing_settings where seller_id=p_seller_id;

  insert into public.orders(seller_id,buyer_id,buyer_email,customer_name,customer_phone,customer_note,status,delivery_point_id,delivery_store_name,delivery_location_name,sinpe_phone_snapshot,created_at,updated_at)
  values(p_seller_id,v_buyer_id,auth.jwt()->>'email',v_buyer.public_name,v_buyer.whatsapp,nullif(btrim(p_customer_note),''),'inventory_confirmation',v_point.id,v_point.store_name,v_point.location_name,v_seller.sinpe_mobile,now(),now()) returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := greatest(0,coalesce((v_item->>'quantity')::integer,0));
    if v_qty < 1 then raise exception 'INVALID_QUANTITY'; end if;
    select * into v_inventory from public.inventory_items where id=(v_item->>'inventory_item_id')::bigint and seller_id=p_seller_id and available=true and quantity>=v_qty for update;
    if not found then raise exception 'ITEM_UNAVAILABLE'; end if;
    v_finish := lower(regexp_replace(btrim(v_inventory.finish),'[ _-]+','','g')); if v_finish='normal' then v_finish:='nonfoil'; end if;
    v_condition := upper(btrim(v_inventory.condition));
    if v_inventory.pricing_mode='custom' then v_unit_price:=v_inventory.custom_price_crc;
    else
      select cp.price_usd into v_price_usd from public.card_prices cp join public.cards c on c.scryfall_id=cp.scryfall_id
      where c.id=v_inventory.card_id and cp.source='cardkingdom' and lower(regexp_replace(btrim(cp.finish),'[ _-]+','','g'))=v_finish and upper(btrim(cp.condition))=v_condition limit 1;
      if v_price_usd is null then raise exception 'PRICE_UNAVAILABLE'; end if;
      v_unit_price:=round(v_price_usd*v_usd_to_crc); if v_inventory.pricing_mode='discount' then v_unit_price:=round(v_unit_price*(1-v_discount/100)); end if;
    end if;
    if v_unit_price is null then raise exception 'PRICE_UNAVAILABLE'; end if;
    insert into public.order_items(order_id,inventory_item_id,quantity,requested_quantity,unit_price_crc,pricing_mode,finish,condition,language)
    values(v_order_id,v_inventory.id,v_qty,v_qty,v_unit_price,v_inventory.pricing_mode,v_inventory.finish,v_inventory.condition,v_inventory.language);
  end loop;
  insert into public.order_events(order_id,actor_id,actor_role,event_type,message) values(v_order_id,v_buyer_id,'buyer','order_created','Buyer submitted checkout for seller inventory confirmation');
  return v_order_id;
end;
$$;

revoke all on function public.create_checkout_order(uuid,bigint,jsonb,text) from public;
grant execute on function public.create_checkout_order(uuid,bigint,jsonb,text) to authenticated;
