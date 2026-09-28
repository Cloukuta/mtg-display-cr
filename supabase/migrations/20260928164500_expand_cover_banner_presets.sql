alter table public.profiles
  drop constraint if exists profiles_cover_banner_preset_check;

alter table public.profiles
  add constraint profiles_cover_banner_preset_check
  check (cover_banner_preset in (
    'portal','forest','mountain','ocean','ember','arcane',
    'azorius','dimir','golgari','izzet','rakdos','selesnya'
  ));
