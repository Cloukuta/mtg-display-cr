-- Display CR — Store & Certified Store foundation
-- Roadmap: #171
-- Run manually in the Supabase SQL Editor after reviewing on the target project.
-- Existing profiles safely default to individual + unverified.

begin;

alter table public.profiles
  add column if not exists seller_type text not null default 'individual',
  add column if not exists verification_status text not null default 'unverified',
  add column if not exists store_name text,
  add column if not exists store_logo_url text,
  add column if not exists store_description text,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid,
  add column if not exists verification_notes text,
  add column if not exists verification_contact text;

-- Keep the initial model deliberately small and explicit.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_seller_type_check'
  ) then
    alter table public.profiles
      add constraint profiles_seller_type_check
      check (seller_type in ('individual','store'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_verification_status_check'
  ) then
    alter table public.profiles
      add constraint profiles_verification_status_check
      check (verification_status in ('unverified','pending','verified'));
  end if;
end $$;

-- Normalize any pre-existing rows if this script is re-run after partial manual work.
update public.profiles
set seller_type = 'individual'
where seller_type is null;

update public.profiles
set verification_status = 'unverified'
where verification_status is null;

create index if not exists profiles_store_discovery_idx
  on public.profiles (seller_type, verification_status, published)
  where published = true;

-- Public-safe projection. Keep private verification notes/contact/audit actor out of storefront queries.
create or replace view public.public_seller_profiles
with (security_invoker = true)
as
select
  id,
  public_name,
  slug,
  location,
  published,
  seller_type,
  verification_status,
  store_name,
  store_logo_url,
  store_description,
  verified_at
from public.profiles
where published = true;

comment on column public.profiles.seller_type is
  'Administrative seller classification. Users must not self-promote to store.';
comment on column public.profiles.verification_status is
  'Administrative verification state. Users must not self-certify.';
comment on column public.profiles.verification_notes is
  'Private Display CR verification notes. Never expose in public storefront queries.';
comment on column public.profiles.verification_contact is
  'Private verification contact/context. Never expose in public storefront queries.';

commit;

-- IMPORTANT SECURITY NOTE
-- The existing profiles UPDATE policy must be checked before production use.
-- PostgreSQL RLS policies are row-based and do not automatically provide column-level protection.
-- If the browser currently has direct UPDATE access to public.profiles, do NOT expose UI that writes
-- seller_type, verification_status, verified_at, verified_by, verification_notes or verification_contact.
-- The follow-up admin/CMS integration should mutate these fields through a trusted server/admin path.
