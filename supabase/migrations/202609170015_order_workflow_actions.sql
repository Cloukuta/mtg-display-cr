-- MTG Display CR
-- Secure buyer/seller order workflow transitions.

create or replace function public.advance_order_status(
  p_order_id bigint,
  p_action text
)
returns text
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_order public.orders%rowtype;
  v_new_status text;
  v_role text;
  v_event_type text;
  v_message text;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if v_user_id = v_order.seller_id then
    v_role := 'seller';
  elsif v_user_id = v_order.buyer_id then
    v_role := 'buyer';
  else
    raise exception 'ORDER_ACCESS_DENIED';
  end if;

  case p_action
    when 'confirm_inventory' then
      if v_role <> 'seller' or v_order.status <> 'inventory_confirmation' then raise exception 'INVALID_ORDER_ACTION'; end if;
      v_new_status := 'payment_pending';
      v_event_type := 'inventory_confirmed';
      v_message := 'Seller confirmed inventory. Payment is now pending.';

    when 'confirm_payment' then
      if v_role <> 'seller' or v_order.status <> 'payment_pending' then raise exception 'INVALID_ORDER_ACTION'; end if;
      if not exists (
        select 1 from public.order_attachments a
        where a.order_id = p_order_id and a.attachment_type = 'payment_proof'
      ) then raise exception 'PAYMENT_PROOF_REQUIRED'; end if;
      v_new_status := 'paid';
      v_event_type := 'payment_confirmed';
      v_message := 'Seller confirmed payment.';

    when 'start_preparing' then
      if v_role <> 'seller' or v_order.status <> 'paid' then raise exception 'INVALID_ORDER_ACTION'; end if;
      v_new_status := 'preparing_shipment';
      v_event_type := 'shipment_preparation_started';
      v_message := 'Seller started preparing the order.';

    when 'mark_shipped' then
      if v_role <> 'seller' or v_order.status <> 'preparing_shipment' then raise exception 'INVALID_ORDER_ACTION'; end if;
      if not exists (
        select 1 from public.order_attachments a
        where a.order_id = p_order_id and a.attachment_type = 'shipment_proof'
      ) then raise exception 'SHIPMENT_PROOF_REQUIRED'; end if;
      v_new_status := 'shipped';
      v_event_type := 'order_shipped';
      v_message := 'Seller marked the order as shipped.';

    when 'confirm_received' then
      if v_role <> 'buyer' or v_order.status <> 'shipped' then raise exception 'INVALID_ORDER_ACTION'; end if;
      v_new_status := 'completed';
      v_event_type := 'order_completed';
      v_message := 'Buyer confirmed receipt. Order completed.';

    when 'cancel_order' then
      if v_role <> 'seller' or v_order.status not in ('inventory_confirmation','payment_pending') then raise exception 'INVALID_ORDER_ACTION'; end if;
      v_new_status := 'cancelled';
      v_event_type := 'order_cancelled';
      v_message := 'Seller cancelled the order.';

    else
      raise exception 'UNKNOWN_ORDER_ACTION';
  end case;

  update public.orders
  set status = v_new_status,
      inventory_confirmed_at = case when p_action = 'confirm_inventory' then now() else inventory_confirmed_at end,
      payment_confirmed_at = case when p_action = 'confirm_payment' then now() else payment_confirmed_at end,
      shipped_at = case when p_action = 'mark_shipped' then now() else shipped_at end,
      updated_at = now()
  where id = p_order_id;

  insert into public.order_events(order_id, actor_id, actor_role, event_type, message)
  values (p_order_id, v_user_id, v_role, v_event_type, v_message);

  return v_new_status;
end;
$function$;

revoke all on function public.advance_order_status(bigint, text) from public;
grant execute on function public.advance_order_status(bigint, text) to authenticated;
