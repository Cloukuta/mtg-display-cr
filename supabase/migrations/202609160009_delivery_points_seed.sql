-- Canonical Red de Envios locations supplied for MTG Display CR.
-- Safe to run more than once because delivery_points has a unique
-- constraint on (network, location_name, store_name).

insert into public.delivery_points
  (network, location_name, store_name, active, sort_order)
values
  ('red_de_envios', 'Alajuela', 'Duelist Kingdom', true, 10),

  ('red_de_envios', 'San Pedro y Zapote', 'Duelist Kingdom', true, 20),
  ('red_de_envios', 'San Pedro y Zapote', 'Perron Store', true, 21),
  ('red_de_envios', 'San Pedro y Zapote', 'Dice & Cards', true, 22),

  ('red_de_envios', 'Palmares y San Ramón', 'Mystica (Palmares)', true, 30),
  ('red_de_envios', 'Palmares y San Ramón', 'Mystica (San Ramón)', true, 31),
  ('red_de_envios', 'Palmares y San Ramón', 'Velvet Game Store', true, 32),

  ('red_de_envios', 'Heredia', 'Raven House', true, 40),
  ('red_de_envios', 'Heredia', 'Astro City', true, 41),
  ('red_de_envios', 'Heredia', 'Lilith''s Den', true, 42),

  ('red_de_envios', 'Guadalupe', 'Fenix Tienda', true, 50),
  ('red_de_envios', 'Guadalupe', 'Pinky Singles', true, 51),
  ('red_de_envios', 'Guadalupe', 'TCG World', true, 52),

  ('red_de_envios', 'Belén', 'Duelist Kingdom', true, 60),
  ('red_de_envios', 'Belén', 'Burro Singles', true, 61),

  ('red_de_envios', 'San José', 'Bluff Store', true, 70),
  ('red_de_envios', 'San José', 'Kira Shop', true, 71),

  ('red_de_envios', 'Calle Blancos', 'Olympus Garden', true, 80),

  ('red_de_envios', 'Liberia', 'Ruta 5', true, 90),

  ('red_de_envios', 'Cartago', 'Zeus Hobby Store', true, 100),
  ('red_de_envios', 'Cartago', 'Imperium Hobby Shop', true, 101),

  ('red_de_envios', 'Turrialba', 'Santuario Geek', true, 110),

  ('red_de_envios', 'Coronado', 'Krypton Hobby Store', true, 120),

  ('red_de_envios', 'Moravia', 'Trinity TCG', true, 130),

  ('red_de_envios', 'San Carlos', 'Arleyy TCG Center', true, 140)
on conflict (network, location_name, store_name)
do update set
  active = excluded.active,
  sort_order = excluded.sort_order,
  updated_at = now();
