-- MTG Display CR
-- Inventory confirmation proposals, buyer approval, and auditable cancellations.

alter table public.orders
  add column if not exists inventory_changes_pending boolean not null default false,
  add column if not exists response_required_from text check (response_required_from in ('buyer','seller')),
  add column if not exists response_required_at timestamptz,
  add column if not exists cancelled_by uuid references public.profiles(id),
  add column if not exists cancellation_reason text,
  add column if not exists cancellation_note text,
  add column if not exists cancelled_at timestamptz;

alter table public.order_items
  add column if not exists seller_confirmed_quantity integer,
  add constraint order_items_seller_confirmed_quantity_check
    check (seller_confirmed_quantity is null or seller_confirmed_quantity >= 0);

create or replace function public.propose_inventory_confirmation(
  p_order_id bigint,
  p_items jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_order public.orders%rowtype;
  v_item jsonb;
  v_order_item public.order_items%rowtype;
  v_qty integer;
  v_changed boolean := false;
  v_remaining integer := 0;
  v_subtotal numeric := 0;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.seller_id <> v_user then raise exception 'ORDER_ACCESS_DENIED'; end if;
  if v_order.status <> 'inventory_confirmation' then raise exception 'INVALID_ORDER_ACTION'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'INVALID_ITEMS'; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_order_item from public.order_items
    where id = (v_item->>'order_item_id')::bigint and order_id = p_order_id for update;
    if not found then raise exception 'ORDER_ITEM_NOT_FOUND'; end if;
    v_qty := (v_item->>'quantity')::integer;
    if v_qty < 0 or v_qty > v_order_item.requested_quantity then raise exception 'INVALID_QUANTITY'; end if;
    update public.order_items set seller_confirmed_quantity = v_qty where id = v_order_item.id;
    v_remaining := v_remaining + v_qty;
    v_subtotal := v_subtotal + (v_qty * v_order_item.unit_price_crc);
    if v_qty <> v_order_item.requested_quantity then v_changed := true; end if;
  end loop;

  if v_remaining = 0 then raise exception 'ORDER_HAS_NO_ITEMS'; end if;

  update public.orders
  set subtotal_crc = v_subtotal,
      total_crc = v_subtotal + coalesce(shipping_fee_crc,0),
      inventory_changes_pending = v_changed,
      response_required_from = case when v_changed then 'buyer' else null end,
      response_required_at = case when v_changed then now() else null end,
      status = case when v_changed then 'inventory_confirmation' else 'payment_pending' end,
      inventory_confirmed_at = case when v_changed then inventory_confirmed_at else now() end,
      updated_at = now()
  where id = p_order_id;

  insert into public.order_events(order_id,actor_id,actor_role,event_type,message)
  values(p_order_id,v_user,'seller',case when v_changed then 'inventory_changes_proposed' else 'inventory_confirmed' end,
    case when v_changed then 'Seller proposed inventory quantity changes. Buyer approval required.' else 'Seller confirmed requested inventory. Payment is now pending.' end);

  return case when v_changed then 'buyer_approval_required' else 'payment_pending' end;
end;
$function$;

create or replace function public.respond_inventory_changes(p_order_id bigint,p_accept boolean)
returns text language plpgsql security definer set search_path=public as $function$
declare v_user uuid:=auth.uid(); v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_user is null or v_order.buyer_id<>v_user then raise exception 'ORDER_ACCESS_DENIED'; end if;
  if v_order.status<>'inventory_confirmation' or not v_order.inventory_changes_pending then raise exception 'INVALID_ORDER_ACTION'; end if;
  if p_accept then
    update public.order_items set quantity=coalesce(seller_confirmed_quantity,quantity) where order_id=p_order_id;
    update public.orders set status='payment_pending',inventory_changes_pending=false,response_required_from=null,response_required_at=null,inventory_confirmed_at=now(),updated_at=now() where id=p_order_id;
    insert into public.order_events(order_id,actor_id,actor_role,event_type,message) values(p_order_id,v_user,'buyer','inventory_changes_accepted','Buyer accepted the seller inventory changes. Payment is now pending.');
    return 'payment_pending';
  else
    update public.orders set response_required_from='seller',response_required_at=now(),updated_at=now() where id=p_order_id;
    insert into public.order_events(order_id,actor_id,actor_role,event_type,message) values(p_order_id,v_user,'buyer','inventory_changes_rejected','Buyer did not accept the proposed inventory changes.');
    return 'inventory_confirmation';
  end if;
end;$function$;

create or replace function public.cancel_order_with_reason(p_order_id bigint,p_reason text,p_note text default null)
returns text language plpgsql security definer set search_path=public as $function$
declare v_user uuid:=auth.uid(); v_order public.orders%rowtype; v_role text; v_elapsed interval; v_allowed text[];
begin
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_user=v_order.buyer_id then v_role:='buyer'; elsif v_user=v_order.seller_id then v_role:='seller'; else raise exception 'ORDER_ACCESS_DENIED'; end if;
  if v_order.status in ('completed','cancelled','paid','preparing_shipment','shipped') then raise exception 'INVALID_ORDER_ACTION'; end if;
  v_allowed:=array['insufficient_inventory','buyer_changed_mind','changes_not_agreed','other'];
  if p_reason=any(v_allowed) then null;
  elsif p_reason in ('seller_no_response_24h','seller_no_response_48h') then
    if v_role<>'buyer' or v_order.response_required_from<>'seller' or v_order.response_required_at is null then raise exception 'CANCELLATION_REASON_NOT_AVAILABLE'; end if;
    v_elapsed:=now()-v_order.response_required_at;
    if p_reason='seller_no_response_24h' and v_elapsed<interval '24 hours' then raise exception 'CANCELLATION_REASON_NOT_AVAILABLE'; end if;
    if p_reason='seller_no_response_48h' and v_elapsed<interval '48 hours' then raise exception 'CANCELLATION_REASON_NOT_AVAILABLE'; end if;
  elsif p_reason in ('buyer_no_response_24h','buyer_no_response_48h') then
    if v_role<>'seller' or v_order.response_required_from<>'buyer' or v_order.response_required_at is null then raise exception 'CANCELLATION_REASON_NOT_AVAILABLE'; end if;
    v_elapsed:=now()-v_order.response_required_at;
    if p_reason='buyer_no_response_24h' and v_elapsed<interval '24 hours' then raise exception 'CANCELLATION_REASON_NOT_AVAILABLE'; end if;
    if p_reason='buyer_no_response_48h' and v_elapsed<interval '48 hours' then raise exception 'CANCELLATION_REASON_NOT_AVAILABLE'; end if;
  else raise exception 'INVALID_CANCELLATION_REASON'; end if;
  if p_reason='insufficient_inventory' and v_role<>'seller' then raise exception 'CANCELLATION_REASON_NOT_AVAILABLE'; end if;
  if p_reason='buyer_changed_mind' and v_role<>'buyer' then raise exception 'CANCELLATION_REASON_NOT_AVAILABLE'; end if;
  update public.orders set status='cancelled',cancelled_by=v_user,cancellation_reason=p_reason,cancellation_note=nullif(btrim(p_note),''),cancelled_at=now(),response_required_from=null,response_required_at=null,updated_at=now() where id=p_order_id;
  insert into public.order_events(order_id,actor_id,actor_role,event_type,message) values(p_order_id,v_user,v_role,'order_cancelled','Order cancelled. Reason: '||p_reason||coalesce('. Note: '||nullif(btrim(p_note),''),''));
  return 'cancelled';
end;$function$;

revoke all on function public.propose_inventory_confirmation(bigint,jsonb) from public;
revoke all on function public.respond_inventory_changes(bigint,boolean) from public;
revoke all on function public.cancel_order_with_reason(bigint,text,text) from public;
grant execute on function public.propose_inventory_confirmation(bigint,jsonb) to authenticated;
grant execute on function public.respond_inventory_changes(bigint,boolean) to authenticated;
grant execute on function public.cancel_order_with_reason(bigint,text,text) to authenticated;
