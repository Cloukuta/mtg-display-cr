-- Hotfix: notifications must never block checkout/order state changes.
-- `orders` exposes the order key as NEW.id, while related tables such as
-- `order_messages` expose it as NEW.order_id. Using to_jsonb(NEW) avoids
-- PL/pgSQL resolving a field that does not exist on one of those row types.
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
  v_target uuid;
  v_type text := 'order_update';
  v_title text := 'Actualización de pedido';
  v_body text := 'Tu pedido tiene una actualización.';
begin
  if tg_table_name = 'orders' then
    v_order_id := nullif(to_jsonb(new)->>'id', '')::bigint;
  else
    v_order_id := nullif(to_jsonb(new)->>'order_id', '')::bigint;
  end if;

  if v_order_id is null then
    return new;
  end if;

  select o.buyer_id, o.seller_id
    into v_buyer_id, v_seller_id
  from public.orders o
  where o.id = v_order_id;

  if not found then
    return new;
  end if;

  if tg_table_name = 'orders' then
    if tg_op = 'INSERT' then
      v_target := v_seller_id;
      v_type := 'order_created';
      v_title := 'Nuevo pedido';
      v_body := 'Recibiste un nuevo pedido.';
    else
      if new.response_required_from = 'seller' then
        v_target := v_seller_id;
      elsif new.response_required_from = 'buyer' then
        v_target := v_buyer_id;
      else
        v_target := case when auth.uid() = v_seller_id then v_buyer_id else v_seller_id end;
      end if;
    end if;
  else
    v_target := case when auth.uid() = v_seller_id then v_buyer_id else v_seller_id end;
  end if;

  if v_target is not null then
    insert into public.notifications(user_id, order_id, type, title, body, href)
    values(v_target, v_order_id, v_type, v_title, v_body, '/orders/' || v_order_id::text);
  end if;

  return new;
exception
  when others then
    -- Notification delivery is secondary: never roll back checkout/order changes.
    raise warning 'create_order_notification skipped: %', sqlerrm;
    return new;
end;
$$;
