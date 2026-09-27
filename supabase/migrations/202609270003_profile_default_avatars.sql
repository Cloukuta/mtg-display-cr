alter table public.profiles
add column if not exists avatar_key text;

alter table public.profiles
drop constraint if exists profiles_avatar_key_check;

alter table public.profiles
add constraint profiles_avatar_key_check
check (avatar_key is null or avatar_key in ('avatar-01','avatar-02','avatar-03','avatar-04','avatar-05','avatar-06'));

comment on column public.profiles.avatar_key is 'MTG Display default avatar selected by an individual seller. Store branding uses a separate future logo field.';
