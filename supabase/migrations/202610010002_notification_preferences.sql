-- W3.2 — Account-level notification preferences
-- External email/WhatsApp delivery is intentionally NOT implemented here.

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default false,
  whatsapp_enabled boolean not null default false,
  whatsapp_phone text,
  whatsapp_opt_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_preferences_whatsapp_consent_check check (
    (whatsapp_enabled = false)
    or (whatsapp_phone is not null and btrim(whatsapp_phone) <> '' and whatsapp_opt_in_at is not null)
  )
);

alter table public.notification_preferences enable row level security;

drop policy if exists "notification_preferences_select_own" on public.notification_preferences;
create policy "notification_preferences_select_own"
on public.notification_preferences
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "notification_preferences_insert_own" on public.notification_preferences;
create policy "notification_preferences_insert_own"
on public.notification_preferences
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "notification_preferences_update_own" on public.notification_preferences;
create policy "notification_preferences_update_own"
on public.notification_preferences
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update on public.notification_preferences to authenticated;

comment on table public.notification_preferences is
  'Per-user account notification channel preferences. Web Push subscriptions remain device-scoped in push_subscriptions.';
comment on column public.notification_preferences.email_enabled is
  'Preference only in W3.2; external email delivery is connected in W3.3.';
comment on column public.notification_preferences.whatsapp_enabled is
  'Explicit opt-in preference only; provider delivery is connected in W5.';
