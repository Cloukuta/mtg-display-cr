-- Inventory approval can remove a line from the final order by confirming quantity 0.
-- Keep requested_quantity > 0, but allow the accepted/final quantity to be 0.

alter table public.order_items
  drop constraint if exists order_items_quantity_check;

alter table public.order_items
  add constraint order_items_quantity_check
  check (quantity >= 0);
