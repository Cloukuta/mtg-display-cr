-- Allow the same card variant to exist independently in multiple binders.
-- Existing inventory already has binder_id populated by the binder migrations.

alter table public.inventory_items
  drop constraint if exists inventory_items_seller_id_scryfall_id_language_finish_condition_key;

create unique index if not exists inventory_items_unique_variant_per_binder
  on public.inventory_items (seller_id, binder_id, scryfall_id, language, finish, condition);
