create or replace function public.get_order_message_push_targets(p_order_id bigint, p_message_id bigint)
returns table(id uuid, endpoint text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender uuid := auth.uid();
  v_recipient uuid;
begin
  if v_sender is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select case
    when o.buyer_id = v_sender then o.seller_id
    when o.seller_id = v_sender then o.buyer_id
    else null
  end
  into v_recipient
  from public.orders o
  join public.order_messages m
    on m.order_id = o.id
   and m.id = p_message_id
   and m.sender_id = v_sender
  where o.id = p_order_id;

  if v_recipient is null then
    raise exception 'MESSAGE_PUSH_NOT_ALLOWED';
  end if;

  return query
  select ps.id, ps.endpoint
  from public.push_subscriptions ps
  where ps.user_id = v_recipient;
end;
$$;

revoke all on function public.get_order_message_push_targets(bigint, bigint) from public;
grant execute on function public.get_order_message_push_targets(bigint, bigint) to authenticated;
