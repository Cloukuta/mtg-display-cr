-- W3.3.6: align sale email with the production order event and suppress the
-- redundant order_update emitted during initial checkout setup.

-- Production uses order_created (not the legacy new_order name) for a new sale.
create or replace function public.enqueue_supported_email_notification()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_email_enabled boolean := false;
  v_template_key text;
  v_event_key text;
begin
  if new.type not in ('order_created', 'wishlist_available') then
    return new;
  end if;

  if new.type = 'wishlist_available' then
    select coalesce(np.email_enabled, false)
      into v_email_enabled
    from public.notification_preferences np
    where np.user_id = new.user_id;

    if not coalesce(v_email_enabled, false) then
      return new;
    end if;

    v_template_key := 'wishlist_available';
  else
    -- New-sale email is transactional for the seller.
    v_template_key := 'sale_created';
  end if;

  select u.email
    into v_email
  from auth.users u
  where u.id = new.user_id;

  if nullif(trim(coalesce(v_email, '')), '') is null then
    return new;
  end if;

  v_event_key := 'notification:' || new.id::text;

  insert into public.email_notification_outbox (
    user_id,
    recipient_email,
    template_key,
    locale,
    payload,
    status,
    event_key
  )
  values (
    new.user_id,
    v_email,
    v_template_key,
    'es',
    jsonb_build_object(
      'notification_id', new.id,
      'notification_type', new.type,
      'title', new.title,
      'body', new.body,
      'href', new.href,
      'order_id', new.order_id,
      'wishlist_item_id', new.wishlist_item_id
    ),
    'pending',
    v_event_key
  )
  on conflict (user_id, template_key, event_key)
    where event_key is not null
  do nothing;

  return new;
end;
$$;

revoke all on function public.enqueue_supported_email_notification() from public;

comment on function public.enqueue_supported_email_notification() is
  'Queues email only for production order_created sale events and newly available Wishlist cards.';

-- The orders row is updated immediately after checkout creation while the same
-- initial transaction/setup is still being completed. That generic update adds
-- no useful information beside "Nuevo pedido", so suppress it only for the
-- short initial creation window. Later order updates remain untouched.
create or replace function public.create_order_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id bigint;
  v_buyer_id uuid;
  v_seller_id uuid;
  v_order_created_at timestamptz;
  v_target uuid;
  v_type text := 'order_update';
  v_title text;
  v_body text;
begin
  if tg_table_name = 'orders' then
    v_order_id := nullif(to_jsonb(new)->>'id', '')::bigint;
  else
    v_order_id := nullif(to_jsonb(new)->>'order_id', '')::bigint;
  end if;

  if v_order_id is null then
    return new;
  end if;

  select o.buyer_id, o.seller_id, o.created_at
    into v_buyer_id, v_seller_id, v_order_created_at
  from public.orders o
  where o.id = v_order_id;

  if not found then
    return new;
  end if;

  if tg_table_name = 'orders' then
    if tg_op = 'INSERT' then
      v_target := v_seller_id;
      v_type := 'order_created';
      v_title := 'Nuevo pedido #' || v_order_id::text;
      v_body := 'Recibiste un nuevo pedido. Pedido #' || v_order_id::text || '.';
    else
      -- Checkout performs an immediate follow-up UPDATE after INSERT. Do not
      -- notify that generic setup update; the seller already received the
      -- order_created notification. This does not suppress later lifecycle updates.
      if v_order_created_at is not null
         and now() - v_order_created_at < interval '10 seconds' then
        return new;
      end if;

      if new.response_required_from = 'seller' then
        v_target := v_seller_id;
      elsif new.response_required_from = 'buyer' then
        v_target := v_buyer_id;
      else
        v_target := case when auth.uid() = v_seller_id then v_buyer_id else v_seller_id end;
      end if;

      v_title := 'Pedido #' || v_order_id::text || ' actualizado';
      v_body := 'El pedido #' || v_order_id::text || ' tiene una actualización.';
    end if;
  else
    v_target := case when auth.uid() = v_seller_id then v_buyer_id else v_seller_id end;
    v_title := 'Pedido #' || v_order_id::text || ' actualizado';
    v_body := 'El pedido #' || v_order_id::text || ' tiene una actualización.';
  end if;

  if v_target is not null then
    insert into public.notifications(user_id, order_id, type, title, body, href)
    values(v_target, v_order_id, v_type, v_title, v_body, '/orders/' || v_order_id::text);
  end if;

  return new;
exception
  when others then
    raise warning 'create_order_notification skipped: %', sqlerrm;
    return new;
end;
$$;

comment on function public.create_order_notification() is
  'Creates order notifications and suppresses only the redundant immediate post-checkout order_update.';
