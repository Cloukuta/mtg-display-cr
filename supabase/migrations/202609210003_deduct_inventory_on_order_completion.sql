-- Deduct sold inventory atomically when the buyer confirms receipt.
-- Fixes #82.

create or replace function public.advance_order_status(p_order_id bigint,p_action text)
returns text language plpgsql security definer set search_path=public as $$
declare
  v_user_id uuid:=auth.uid();
  v_order public.orders%rowtype;
  v_new_status text;
  v_role text;
  v_event_type text;
  v_message text;
  v_item record;
  v_inventory public.inventory_items%rowtype;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_user_id=v_order.seller_id then v_role:='seller';
  elsif v_user_id=v_order.buyer_id then v_role:='buyer';
  else raise exception 'ORDER_ACCESS_DENIED'; end if;

  case p_action
    when 'confirm_payment' then
      if v_role<>'seller' or v_order.status<>'payment_submitted' then raise exception 'INVALID_ORDER_ACTION'; end if;
      if not exists(select 1 from public.order_attachments a where a.order_id=p_order_id and a.uploaded_by=v_order.buyer_id and a.attachment_type='payment_proof') then raise exception 'PAYMENT_PROOF_REQUIRED'; end if;
      v_new_status:='paid'; v_event_type:='payment_confirmed'; v_message:='Seller confirmed payment. Order is ready to be shipped.';

    when 'mark_shipped' then
      if v_role<>'seller' or v_order.status<>'paid' then raise exception 'INVALID_ORDER_ACTION'; end if;
      if not exists(select 1 from public.order_attachments a where a.order_id=p_order_id and a.uploaded_by=v_order.seller_id and a.attachment_type='shipment_proof') then raise exception 'SHIPMENT_PROOF_REQUIRED'; end if;
      v_new_status:='shipped'; v_event_type:='order_shipped'; v_message:='Seller marked the order as shipped.';

    when 'confirm_received' then
      if v_role<>'buyer' or v_order.status<>'shipped' then raise exception 'INVALID_ORDER_ACTION'; end if;

      -- Lock and validate every linked inventory row before changing any quantity.
      for v_item in
        select oi.inventory_item_id, sum(oi.quantity)::integer as sold_quantity
        from public.order_items oi
        where oi.order_id=p_order_id
        group by oi.inventory_item_id
        order by oi.inventory_item_id
      loop
        if v_item.inventory_item_id is null then raise exception 'ORDER_ITEM_INVENTORY_MISSING'; end if;
        select * into v_inventory from public.inventory_items where id=v_item.inventory_item_id for update;
        if not found then raise exception 'INVENTORY_ITEM_NOT_FOUND'; end if;
        if v_inventory.seller_id<>v_order.seller_id then raise exception 'INVENTORY_SELLER_MISMATCH'; end if;
        if v_inventory.quantity<v_item.sold_quantity then raise exception 'INSUFFICIENT_INVENTORY'; end if;
      end loop;

      -- All rows validated: apply deductions inside this same transaction.
      for v_item in
        select oi.inventory_item_id, sum(oi.quantity)::integer as sold_quantity
        from public.order_items oi
        where oi.order_id=p_order_id
        group by oi.inventory_item_id
        order by oi.inventory_item_id
      loop
        update public.inventory_items
        set quantity=quantity-v_item.sold_quantity,
            available=case when quantity-v_item.sold_quantity<=0 then false else available end,
            updated_at=now()
        where id=v_item.inventory_item_id;
      end loop;

      v_new_status:='completed'; v_event_type:='order_completed'; v_message:='Buyer confirmed receipt. Order completed and sold inventory deducted.';
    else raise exception 'UNKNOWN_ORDER_ACTION';
  end case;

  update public.orders set status=v_new_status,
    payment_confirmed_at=case when p_action='confirm_payment' then now() else payment_confirmed_at end,
    shipped_at=case when p_action='mark_shipped' then now() else shipped_at end,
    completed_at=case when p_action='confirm_received' then now() else completed_at end,
    response_required_from=case when p_action='confirm_payment' then 'seller' when p_action='mark_shipped' then 'buyer' when p_action='confirm_received' then null else response_required_from end,
    response_required_at=case when p_action in ('confirm_payment','mark_shipped') then now() when p_action='confirm_received' then null else response_required_at end,
    updated_at=now()
  where id=p_order_id;

  insert into public.order_events(order_id,actor_id,actor_role,event_type,message)
  values(p_order_id,v_user_id,v_role,v_event_type,v_message);
  return v_new_status;
end;$$;

grant execute on function public.advance_order_status(bigint,text) to authenticated;
