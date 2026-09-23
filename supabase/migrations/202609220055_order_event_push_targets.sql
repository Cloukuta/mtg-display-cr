create or replace function public.get_order_event_push_targets(p_order_id bigint, p_event_type text)
returns table(id uuid, endpoint text, p256dh text, auth_key text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_buyer uuid;
  v_seller uuid;
  v_recipient uuid;
  v_status text;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED'; end if;

  select o.buyer_id,o.seller_id,o.status into v_buyer,v_seller,v_status
  from public.orders o where o.id=p_order_id;
  if v_buyer is null or (v_actor<>v_buyer and v_actor<>v_seller) then raise exception 'ORDER_PUSH_NOT_ALLOWED'; end if;

  if p_event_type='inventory_proposed' and v_actor=v_seller and v_status in ('inventory_confirmation','preparing_shipment') then v_recipient:=v_buyer;
  elsif p_event_type='inventory_response' and v_actor=v_buyer then v_recipient:=v_seller;
  elsif p_event_type='payment_requested' and v_actor=v_seller and v_status='payment_pending' then v_recipient:=v_buyer;
  elsif p_event_type='payment_submitted' and v_actor=v_buyer and v_status='payment_submitted' then v_recipient:=v_seller;
  elsif p_event_type='payment_confirmed' and v_actor=v_seller and v_status='paid' then v_recipient:=v_buyer;
  elsif p_event_type='shipped' and v_actor=v_seller and v_status='shipped' then v_recipient:=v_buyer;
  elsif p_event_type='completed' and v_status='completed' then v_recipient:=case when v_actor=v_buyer then v_seller else v_buyer end;
  elsif p_event_type='cancelled' and v_status='cancelled' then v_recipient:=case when v_actor=v_buyer then v_seller else v_buyer end;
  else raise exception 'ORDER_PUSH_EVENT_NOT_ALLOWED'; end if;

  return query select ps.id,ps.endpoint,ps.p256dh,ps.auth_key from public.push_subscriptions ps where ps.user_id=v_recipient;
end;
$$;
revoke all on function public.get_order_event_push_targets(bigint,text) from public;
grant execute on function public.get_order_event_push_targets(bigint,text) to authenticated;
