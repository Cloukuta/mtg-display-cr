-- Guarantee every profile has exactly one immutable default Trade Binder.
-- The original binder migration only backfilled sellers that already had inventory.
-- This migration also covers brand-new/empty accounts and repairs existing profiles.

-- Backfill every existing profile that does not yet have a default binder.
insert into public.binders (seller_id, name, is_default, is_public)
select p.id, 'Trade Binder', true, true
from public.profiles p
where not exists (
  select 1
  from public.binders b
  where b.seller_id = p.id
    and b.is_default = true
)
on conflict do nothing;

-- Keep the invariant for future profiles, even before they import their first card.
create or replace function public.create_trade_binder_for_new_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_trade_binder(new.id);
  return new;
end;
$$;

drop trigger if exists trg_create_trade_binder_for_new_profile on public.profiles;
create trigger trg_create_trade_binder_for_new_profile
after insert on public.profiles
for each row execute function public.create_trade_binder_for_new_profile();

-- Repair any inventory that predates binder assignment.
update public.inventory_items ii
set binder_id = b.id,
    updated_at = now()
from public.binders b
where ii.binder_id is null
  and b.seller_id = ii.seller_id
  and b.is_default = true;
