-- W3.3.4: enqueue only the two email events currently approved for MTG Display CR.
-- 1) new_order       -> seller (transactional, always queued)
-- 2) wishlist_available -> Wishlist owner (only when email_enabled = true)
--
-- Delivery is still handled separately by the Cloudflare/Brevo worker.
-- This migration does not send email by itself.

alter table public.email_notification_outbox
  add column if not exists event_key text;

create unique index if not exists email_notification_outbox_event_dedupe_idx
  on public.email_notification_outbox (user_id, template_key, event_key)
  where event_key is not null;

comment on column public.email_notification_outbox.event_key is
  'Stable source-event key used to prevent duplicate email jobs, e.g. notification:123.';

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
  -- Email is intentionally limited to concrete, high-value events.
  if new.type not in ('new_order', 'wishlist_available') then
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
    -- New-sale email is transactional for the seller and is deliberately
    -- independent from the optional Wishlist email preference.
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

-- Reuse the existing notifications stream as the canonical event source.
-- This avoids duplicating order/Wishlist matching logic in another trigger.
drop trigger if exists enqueue_supported_email_notification_trigger on public.notifications;
create trigger enqueue_supported_email_notification_trigger
after insert on public.notifications
for each row execute function public.enqueue_supported_email_notification();

comment on function public.enqueue_supported_email_notification() is
  'W3.3 queues email only for new sales and newly available Wishlist cards; all other notification types remain out of email.';
