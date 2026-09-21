-- Allow marketplace buyers to discover delivery compatibility with published sellers.
-- Buyer pickup preferences remain private to their owner.
-- Seller dropoff points are marketplace-facing fulfillment data and are readable
-- only when the associated seller profile is currently published.

create policy "published seller dropoff public read"
  on public.profile_delivery_points
  for select
  using (
    role = 'seller_dropoff'
    and exists (
      select 1
      from public.profiles p
      where p.id = profile_delivery_points.profile_id
        and p.published = true
    )
  );
