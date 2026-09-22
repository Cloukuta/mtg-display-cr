-- Order Room Broadcast v1
-- Broadcast a lightweight invalidation whenever persisted order-room data changes.
-- Clients always reload authoritative data from Postgres after receiving it.

create or replace function public.broadcast_order_room_invalidation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id bigint;
begin
  if tg_table_name = 'orders' then
    v_order_id := coalesce(new.id, old.id);
  else
    v_order_id := coalesce(new.order_id, old.order_id);
  end if;

  if v_order_id is not null then
    perform realtime.send(
      jsonb_build_object(
        'orderId', v_order_id,
        'table', tg_table_name,
        'operation', tg_op,
        'at', extract(epoch from clock_timestamp()) * 1000
      ),
      'invalidate',
      'order-room-' || v_order_id::text,
      false
    );
  end if;

  return coalesce(new, old);
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array['orders','order_messages','order_attachments','order_events','order_items']
  loop
    execute format('drop trigger if exists order_room_broadcast_invalidation on public.%I', v_table);
    execute format(
      'create trigger order_room_broadcast_invalidation after insert or update or delete on public.%I for each row execute function public.broadcast_order_room_invalidation()',
      v_table
    );
  end loop;
end $$;

comment on function public.broadcast_order_room_invalidation() is
'Sends a public Supabase Realtime Broadcast invalidation to order-room-<order_id>; clients reload authoritative order data after receiving it.';
