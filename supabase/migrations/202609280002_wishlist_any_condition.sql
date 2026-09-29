-- W1 follow-up: allow a wishlist item to accept any physical card condition.
-- W2 matching semantics: condition = 'ANY' matches every inventory condition.

alter table public.wishlist_items
  drop constraint if exists wishlist_items_condition_check;

alter table public.wishlist_items
  add constraint wishlist_items_condition_check
  check (condition in ('ANY','NM','EX','VG','G','PL','PO'));
