-- MTG Display CR
-- Allow visitors to resolve public catalog prices with the seller's configured
-- USD -> CRC conversion and discount percentage.

create policy "pricing settings published catalog read"
on public.seller_pricing_settings
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = seller_pricing_settings.seller_id
      and p.published = true
  )
);
