-- W3.3 Email availability delivery foundation
-- Provider-agnostic outbox. Delivery workers must use service-role/server-side access only.

create table if not exists public.email_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wishlist_notification_id uuid null,
  recipient_email text not null,
  template_key text not null default 'wishlist_available',
  locale text not null default 'es' check (locale in ('es','en')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed')),
  provider text null,
  provider_message_id text null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text null,
  next_attempt_at timestamptz null,
  sent_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_notification_outbox_pending_idx
  on public.email_notification_outbox (status, next_attempt_at, created_at)
  where status in ('pending','failed');

create index if not exists email_notification_outbox_user_idx
  on public.email_notification_outbox (user_id, created_at desc);

-- One availability event should create at most one email job per user/template.
create unique index if not exists email_notification_outbox_dedupe_idx
  on public.email_notification_outbox (user_id, wishlist_notification_id, template_key)
  where wishlist_notification_id is not null;

alter table public.email_notification_outbox enable row level security;

-- Intentionally no client RLS policies. This is infrastructure state, not a user-editable table.
-- Server-side workers/service-role may enqueue and process rows while respecting
-- notification_preferences.email_enabled before enqueue/send.

comment on table public.email_notification_outbox is
  'W3.3 provider-agnostic email delivery queue for availability notifications.';
comment on column public.email_notification_outbox.payload is
  'Template data only; do not store provider API secrets or unnecessary personal data.';
