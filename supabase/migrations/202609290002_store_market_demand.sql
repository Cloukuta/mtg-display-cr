-- W4.1: Store-only aggregated Wishlist market demand.
-- Privacy guarantees:
-- - Only authenticated profiles with seller_type = 'store' can execute the RPC.
-- - No wishlist user_id, wishlist row id, or public_id is returned.
-- - A demand group is visible only when at least 3 distinct users participate.
-- - Inventory is returned only as aggregate stock counts.

create or replace function public.get_store_market_demand(
  p_page integer default 1,
  p_page_size integer default 15,
  p_search text default null,
  p_set_code text default null,
  p_finish text default null,
  p_stock text default null,
  p_sort text default 'demand'
)
returns table (
  scryfall_id uuid,
  card_name text,
  set_code text,
  set_name text,
  collector_number text,
  image_uri text,
  finish text,
  language text,
  condition text,
  interested_users bigint,
  requested_copies bigint,
  current_stock bigint,
  context text,
  total_rows bigint,
  total_demand_cards bigint,
  total_requested_copies bigint,
  total_zero_stock bigint,
  total_participating_users bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 15), 1), 50);
  v_offset integer;
  v_is_store boolean := false;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select exists (
    select 1
    from public.profiles p
    where p.id = v_uid
      and lower(coalesce(p.seller_type, '')) = 'store'
  ) into v_is_store;

  if not v_is_store then
    raise exception 'Store account required';
  end if;

  v_offset := (v_page - 1) * v_page_size;

  return query
  with demand_base as (
    select
      w.scryfall_id,
      min(w.name) as card_name,
      lower(coalesce(w.set_code, '')) as set_code,
      min(w.set_name) as set_name,
      min(w.collector_number) as collector_number,
      min(w.image_uri) as image_uri,
      lower(coalesce(w.finish, 'nonfoil')) as finish,
      lower(coalesce(w.language, 'en')) as language,
      upper(coalesce(w.condition, 'ANY')) as condition,
      count(distinct w.user_id)::bigint as interested_users,
      sum(greatest(coalesce(w.quantity, 1), 1))::bigint as requested_copies
    from public.wishlist_items w
    group by
      w.scryfall_id,
      lower(coalesce(w.set_code, '')),
      lower(coalesce(w.finish, 'nonfoil')),
      lower(coalesce(w.language, 'en')),
      upper(coalesce(w.condition, 'ANY'))
    having count(distinct w.user_id) >= 3
  ),
  with_stock as (
    select
      d.*,
      coalesce((
        select sum(greatest(coalesce(i.quantity, 0), 0))::bigint
        from public.inventory_items i
        where i.scryfall_id = d.scryfall_id
          and i.available = true
          and coalesce(i.hidden_by_reservation, false) = false
          and lower(trim(coalesce(i.finish, ''))) = lower(trim(d.finish))
          and lower(trim(coalesce(i.language, ''))) = lower(trim(d.language))
          and (
            d.condition = 'ANY'
            or lower(trim(coalesce(i.condition, ''))) = lower(trim(d.condition))
          )
      ), 0)::bigint as current_stock
    from demand_base d
  ),
  classified as (
    select
      s.*,
      case
        when s.current_stock = 0 then 'NO_STOCK'
        when s.current_stock < s.requested_copies then 'LOW_STOCK'
        when s.interested_users >= 10 then 'HIGH_DEMAND'
        else 'COVERED'
      end::text as context
    from with_stock s
  ),
  filtered as (
    select *
    from classified c
    where (nullif(trim(coalesce(p_search, '')), '') is null
           or c.card_name ilike '%' || trim(p_search) || '%'
           or c.collector_number ilike '%' || trim(p_search) || '%')
      and (nullif(lower(trim(coalesce(p_set_code, ''))), '') is null
           or c.set_code = lower(trim(p_set_code)))
      and (nullif(lower(trim(coalesce(p_finish, ''))), '') is null
           or c.finish = lower(trim(p_finish)))
      and (
        nullif(lower(trim(coalesce(p_stock, ''))), '') is null
        or (lower(trim(p_stock)) = 'none' and c.current_stock = 0)
        or (lower(trim(p_stock)) = 'low' and c.current_stock > 0 and c.current_stock < c.requested_copies)
        or (lower(trim(p_stock)) = 'covered' and c.current_stock >= c.requested_copies)
      )
  ),
  metrics as (
    select
      count(*)::bigint as total_rows,
      count(*)::bigint as total_demand_cards,
      coalesce(sum(f.requested_copies), 0)::bigint as total_requested_copies,
      count(*) filter (where f.current_stock = 0)::bigint as total_zero_stock,
      coalesce((select count(distinct w.user_id)::bigint from public.wishlist_items w), 0)::bigint as total_participating_users
    from filtered f
  ),
  paged as (
    select f.*
    from filtered f
    order by
      case when lower(coalesce(p_sort, 'demand')) = 'demand' then f.interested_users end desc nulls last,
      case when lower(coalesce(p_sort, 'demand')) = 'copies' then f.requested_copies end desc nulls last,
      case when lower(coalesce(p_sort, 'demand')) = 'stock' then f.current_stock end asc nulls last,
      f.card_name asc
    limit v_page_size
    offset v_offset
  )
  select
    p.scryfall_id,
    p.card_name,
    p.set_code,
    p.set_name,
    p.collector_number,
    p.image_uri,
    p.finish,
    p.language,
    p.condition,
    p.interested_users,
    p.requested_copies,
    p.current_stock,
    p.context,
    m.total_rows,
    m.total_demand_cards,
    m.total_requested_copies,
    m.total_zero_stock,
    m.total_participating_users
  from paged p
  cross join metrics m;
end;
$$;

revoke all on function public.get_store_market_demand(integer, integer, text, text, text, text, text) from public;
grant execute on function public.get_store_market_demand(integer, integer, text, text, text, text, text) to authenticated;

comment on function public.get_store_market_demand(integer, integer, text, text, text, text, text)
is 'Store-only W4 aggregated Wishlist demand. Suppresses groups with fewer than 3 distinct users and never returns Wishlist owner identity.';
