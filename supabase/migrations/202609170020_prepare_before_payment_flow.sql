-- Prepare-before-payment lifecycle
-- Seller prepares the physical package and provides evidence before buyer payment.

alter table public.orders
  add column if not exists payment_window_minutes integer,
  add column if not exists payment_requested_at timestamptz,
  add column if not exists payment_expires_at timestamptz,
  add column if not exists payment_submitted_at timestamptz,
  add column if not exists package_ready_at timestamptz;

alter table public.orders drop constraint if exists orders_payment_window_minutes_check;
alter table public.orders add constraint orders_payment_window_minutes_check
  check (payment_window_minutes is null or payment_window_minutes in (5,10,15,30));

create or replace function public.request_order_payment(p_order_id bigint, p_minutes integer default 15)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.orders%rowtype;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_minutes not in (5,10,15,30) then raise exception 'INVALID_PAYMENT_WINDOW'; end if;

  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_user_id <> v_order.seller_id then raise exception 'ORDER_ACCESS_DENIED'; end if;
  if v_order.status <> 'preparing_shipment' then raise exception 'INVALID_ORDER_ACTION'; end if;
  if not exists (
    select 1 from public.order_attachments a
    where a.order_id=p_order_id
      and a.uploaded_by=v_order.seller_id
      and a.attachment_type='package_proof'
  ) then raise exception 'PACKAGE_PROOF_REQUIRED'; end if;

  update public.orders
  set status='payment_pending',
      package_ready_at=coalesce(package_ready_at,now()),
      payment_window_minutes=p_minutes,
      payment_requested_at=now(),
      payment_expires_at=now()+make_interval(mins=>p_minutes),
      response_required_from='buyer',
      response_required_at=now(),
      updated_at=now()
  where id=p_order_id;

  insert into public.order_events(order_id,actor_id,actor_role,event_type,message)
  values(p_order_id,v_user_id,'seller','payment_requested','Seller prepared the package and requested payment.');
  return 'payment_pending';
end;
$$;

create or replace function public.submit_order_payment(p_order_id bigint)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.orders%rowtype;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_user_id <> v_order.buyer_id then raise exception 'ORDER_ACCESS_DENIED'; end if;
  if v_order.status <> 'payment_pending' then raise exception 'INVALID_ORDER_ACTION'; end if;
  if v_order.payment_expires_at is not null and now() > v_order.payment_expires_at then raise exception 'PAYMENT_WINDOW_EXPIRED'; end if;
  if not exists (
    select 1 from public.order_attachments a
    where a.order_id=p_order_id and a.uploaded_by=v_order.buyer_id and a.attachment_type='payment_proof'
  ) then raise exception 'PAYMENT_PROOF_REQUIRED'; end if;

  update public.orders
  set status='payment_submitted',payment_submitted_at=now(),response_required_from='seller',response_required_at=now(),updated_at=now()
  where id=p_order_id;
  insert into public.order_events(order_id,actor_id,actor_role,event_type,message)
  values(p_order_id,v_user_id,'buyer','payment_submitted','Buyer submitted payment proof.');
  return 'payment_submitted';
end;
$$;

create or replace function public.expire_order_payment(p_order_id bigint)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.orders%rowtype;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_user_id not in (v_order.buyer_id,v_order.seller_id) then raise exception 'ORDER_ACCESS_DENIED'; end if;
  if v_order.status <> 'payment_pending' then return v_order.status; end if;
  if v_order.payment_expires_at is null or now() <= v_order.payment_expires_at then raise exception 'PAYMENT_WINDOW_ACTIVE'; end if;
  if exists (select 1 from public.order_attachments a where a.order_id=p_order_id and a.uploaded_by=v_order.buyer_id and a.attachment_type='payment_proof') then
    raise exception 'PAYMENT_PROOF_ALREADY_SUBMITTED';
  end if;
  update public.orders set status='cancelled',cancellation_reason='buyer_payment_timeout',cancellation_note='Payment window expired without proof.',response_required_from=null,response_required_at=null,updated_at=now() where id=p_order_id;
  insert into public.order_events(order_id,actor_id,actor_role,event_type,message)
  values(p_order_id,null,'system','order_cancelled','Payment window expired without buyer payment proof.');
  return 'cancelled';
end;
$$;

create or replace function public.advance_order_status(p_order_id bigint,p_action text)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user_id uuid := auth.uid(); v_order public.orders%rowtype; v_new_status text; v_role text; v_event_type text; v_message text;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_user_id=v_order.seller_id then v_role:='seller'; elsif v_user_id=v_order.buyer_id then v_role:='buyer'; else raise exception 'ORDER_ACCESS_DENIED'; end if;
  case p_action
    when 'confirm_inventory' then
      if v_role<>'seller' or v_order.status<>'inventory_confirmation' then raise exception 'INVALID_ORDER_ACTION'; end if;
      v_new_status:='preparing_shipment'; v_event_type:='inventory_confirmed'; v_message:='Seller confirmed inventory and started package preparation.';
    when 'confirm_payment' then
      if v_role<>'seller' or v_order.status<>'payment_submitted' then raise exception 'INVALID_ORDER_ACTION'; end if;
      if not exists(select 1 from public.order_attachments a where a.order_id=p_order_id and a.uploaded_by=v_order.buyer_id and a.attachment_type='payment_proof') then raise exception 'PAYMENT_PROOF_REQUIRED'; end if;
      v_new_status:='paid'; v_event_type:='payment_confirmed'; v_message:='Seller confirmed payment.';
    when 'mark_shipped' then
      if v_role<>'seller' or v_order.status<>'paid' then raise exception 'INVALID_ORDER_ACTION'; end if;
      if not exists(select 1 from public.order_attachments a where a.order_id=p_order_id and a.uploaded_by=v_order.seller_id and a.attachment_type='shipment_proof') then raise exception 'SHIPMENT_PROOF_REQUIRED'; end if;
      v_new_status:='shipped'; v_event_type:='order_shipped'; v_message:='Seller marked the order as shipped.';
    when 'confirm_received' then
      if v_role<>'buyer' or v_order.status<>'shipped' then raise exception 'INVALID_ORDER_ACTION'; end if;
      v_new_status:='completed'; v_event_type:='order_completed'; v_message:='Buyer confirmed receipt. Order completed.';
    else raise exception 'UNKNOWN_ORDER_ACTION';
  end case;
  update public.orders set status=v_new_status,
    inventory_confirmed_at=case when p_action='confirm_inventory' then now() else inventory_confirmed_at end,
    payment_confirmed_at=case when p_action='confirm_payment' then now() else payment_confirmed_at end,
    shipped_at=case when p_action='mark_shipped' then now() else shipped_at end,
    response_required_from=case when p_action='confirm_inventory' then 'seller' when p_action='confirm_payment' then 'seller' when p_action='mark_shipped' then 'buyer' when p_action='confirm_received' then null else response_required_from end,
    response_required_at=case when p_action in ('confirm_inventory','confirm_payment','mark_shipped') then now() when p_action='confirm_received' then null else response_required_at end,
    updated_at=now() where id=p_order_id;
  insert into public.order_events(order_id,actor_id,actor_role,event_type,message) values(p_order_id,v_user_id,v_role,v_event_type,v_message);
  return v_new_status;
end;
$$;

grant execute on function public.request_order_payment(bigint,integer) to authenticated;
grant execute on function public.submit_order_payment(bigint) to authenticated;
grant execute on function public.expire_order_payment(bigint) to authenticated;
grant execute on function public.advance_order_status(bigint,text) to authenticated;
