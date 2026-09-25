-- Order flow v3, step 1: seller must attach real-card evidence before
-- confirming inventory or proposing quantity changes to the buyer.
--
-- During this first rollout slice the current order-room uploader still stores
-- inventory-confirmation images as `other`. Accept that legacy/current value
-- together with the final `card_proof` type so the backend requirement can be
-- tested independently before the UI/type cleanup lands in the next slice.

create or replace function public.propose_inventory_confirmation(p_order_id bigint,p_items jsonb)
returns text language plpgsql security definer set search_path=public as $$
declare
  v_user uuid:=auth.uid(); v_order public.orders%rowtype; v_item jsonb;
  v_order_item public.order_items%rowtype; v_qty integer; v_changed boolean:=false;
  v_remaining integer:=0; v_subtotal numeric:=0;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.seller_id<>v_user then raise exception 'ORDER_ACCESS_DENIED'; end if;
  if v_order.status<>'inventory_confirmation' then raise exception 'INVALID_ORDER_ACTION'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'INVALID_ITEMS'; end if;

  -- The buyer must be able to review photos of the actual cards before the
  -- order can leave inventory confirmation. `other` is accepted temporarily
  -- because that is what the existing uploader emits in this state.
  if not exists(
    select 1 from public.order_attachments a
    where a.order_id=p_order_id
      and a.uploaded_by=v_order.seller_id
      and a.attachment_type in ('card_proof','other')
  ) then raise exception 'CARD_PROOF_REQUIRED'; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_order_item from public.order_items where id=(v_item->>'order_item_id')::bigint and order_id=p_order_id for update;
    if not found then raise exception 'ORDER_ITEM_NOT_FOUND'; end if;
    v_qty:=(v_item->>'quantity')::integer;
    if v_qty<0 or v_qty>v_order_item.requested_quantity then raise exception 'INVALID_QUANTITY'; end if;
    update public.order_items set seller_confirmed_quantity=v_qty where id=v_order_item.id;
    v_remaining:=v_remaining+v_qty; v_subtotal:=v_subtotal+(v_qty*v_order_item.unit_price_crc);
    if v_qty<>v_order_item.requested_quantity then v_changed:=true; end if;
  end loop;
  if v_remaining=0 then raise exception 'ORDER_HAS_NO_ITEMS'; end if;
  update public.orders set subtotal_crc=v_subtotal,total_crc=v_subtotal+coalesce(shipping_fee_crc,0),
    inventory_changes_pending=v_changed,response_required_from=case when v_changed then 'buyer' else 'seller' end,
    response_required_at=now(),status=case when v_changed then 'inventory_confirmation' else 'preparing_shipment' end,
    inventory_confirmed_at=case when v_changed then inventory_confirmed_at else now() end,updated_at=now()
  where id=p_order_id;
  insert into public.order_events(order_id,actor_id,actor_role,event_type,message)
  values(p_order_id,v_user,'seller',case when v_changed then 'inventory_changes_proposed' else 'inventory_confirmed' end,
    case when v_changed then 'Seller attached card evidence and proposed inventory quantity changes. Buyer approval required.' else 'Seller attached card evidence and confirmed inventory. Package preparation can begin.' end);
  return case when v_changed then 'buyer_approval_required' else 'preparing_shipment' end;
end;$$;

grant execute on function public.propose_inventory_confirmation(bigint,jsonb) to authenticated;

comment on function public.propose_inventory_confirmation(bigint,jsonb) is
'Order flow v3 step 1: seller card evidence is mandatory before inventory confirmation or quantity-change proposal; legacy attachment type other is temporarily accepted during UI rollout.';
