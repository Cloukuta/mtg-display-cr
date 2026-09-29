-- W2 privacy hardening: non-enumerable wishlist offer URLs.
-- Security still relies on RLS + explicit owner checks; public_id is only a non-sequential route identifier.

create extension if not exists pgcrypto;

alter table public.wishlist_items
  add column if not exists public_id uuid;

update public.wishlist_items
set public_id = gen_random_uuid()
where public_id is null;

alter table public.wishlist_items
  alter column public_id set default gen_random_uuid(),
  alter column public_id set not null;

create unique index if not exists wishlist_items_public_id_uidx
  on public.wishlist_items(public_id);
