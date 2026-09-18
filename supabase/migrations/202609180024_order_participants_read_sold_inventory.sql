-- MTG Display CR
-- Keep sold-out inventory/card metadata readable to participants of an order.
--
-- Catalog visibility remains unchanged: public shoppers still only see inventory
-- with available=true and quantity>0. This only grants buyer/seller participants
-- read access to inventory/card rows already referenced by their order_items.

create policy "order participants read referenced inventory"
on public.inventory_items
for select
to authenticated
using (
  exists (
    select 1
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.inventory_item_id = inventory_items.id
      and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
  )
);

create policy "order participants read referenced cards"
on public.cards
for select
to authenticated
using (
  exists (
    select 1
    from public.inventory_items ii
    join public.order_items oi on oi.inventory_item_id = ii.id
    join public.orders o on o.id = oi.order_id
    where ii.scryfall_id = cards.scryfall_id
      and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
  )
);
