-- Add newly confirmed Red de Envios delivery points in San José.
-- Safe to run more than once because delivery_points has a unique
-- constraint on (network, location_name, store_name).

insert into public.delivery_points
  (network, location_name, store_name, active, sort_order)
values
  ('red_de_envios', 'San José', 'Arzu Trading Card Store', true, 72),
  ('red_de_envios', 'San José', 'Maneki TCG Store', true, 73),
  ('red_de_envios', 'San José', 'NYX GAME ARENA', true, 74)
on conflict (network, location_name, store_name)
do update set
  active = excluded.active,
  sort_order = excluded.sort_order,
  updated_at = now();
