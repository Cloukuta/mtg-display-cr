-- Reserve MTG Display identity for the official platform profile.
create or replace function public.normalize_display_identity(value text)
returns text language sql immutable set search_path = public as $$
  select lower(regexp_replace(coalesce(value, ''), '[^a-zA-Z0-9]+', '', 'g'));
$$;

create or replace function public.validate_reserved_display_identity()
returns trigger language plpgsql set search_path = public as $$
declare
  official_profile_id uuid := 'fd67e830-6ef5-4e49-921d-4fb22353ea24'::uuid;
  normalized_public_name text;
  normalized_store_name text;
  normalized_slug text;
begin
  normalized_public_name := public.normalize_display_identity(new.public_name);
  normalized_store_name := public.normalize_display_identity(new.store_name);
  normalized_slug := public.normalize_display_identity(new.slug);
  if new.id <> official_profile_id and (
    normalized_public_name in ('mtgdisplay','mtgdisplaycr') or
    normalized_store_name in ('mtgdisplay','mtgdisplaycr') or
    normalized_slug in ('mtgdisplay','mtgdisplaycr')
  ) then
    raise exception 'RESERVED_MTG_DISPLAY_IDENTITY';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_validate_reserved_display_identity on public.profiles;
create trigger profiles_validate_reserved_display_identity
before insert or update of public_name, store_name, slug on public.profiles
for each row execute function public.validate_reserved_display_identity();
