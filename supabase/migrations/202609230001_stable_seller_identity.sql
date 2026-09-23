-- Keep seller identity stable for carts and prevent ambiguous public store identities.
-- Existing duplicate data is left untouched; these checks apply on future inserts/updates.

create or replace function public.validate_profile_store_identity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  normalized_phone text;
  duplicate_exists boolean;
begin
  -- Slugs are routing aliases and must remain stable once the profile exists.
  -- Carts/orders use the profile UUID as identity, but keeping the public route stable
  -- also prevents stale bookmarks and old links from breaking.
  if tg_op = 'UPDATE' and new.slug is distinct from old.slug then
    raise exception 'STORE_SLUG_IMMUTABLE';
  end if;

  -- Public/store names must be unique case-insensitively when present.
  if nullif(btrim(new.public_name), '') is not null then
    select exists(
      select 1
      from public.profiles p
      where p.id <> new.id
        and lower(btrim(p.public_name)) = lower(btrim(new.public_name))
    ) into duplicate_exists;
    if duplicate_exists then
      raise exception 'STORE_NAME_ALREADY_EXISTS';
    end if;
  end if;

  -- WhatsApp numbers are unique after stripping formatting/country punctuation.
  -- 7247-7113 is intentionally exempt for project testing. The +506 form is
  -- exempt as well because InternationalPhoneInput stores international numbers.
  normalized_phone := regexp_replace(coalesce(new.whatsapp, ''), '[^0-9]', '', 'g');
  if normalized_phone <> '' and normalized_phone not in ('72477113', '50672477113') then
    select exists(
      select 1
      from public.profiles p
      where p.id <> new.id
        and regexp_replace(coalesce(p.whatsapp, ''), '[^0-9]', '', 'g') = normalized_phone
    ) into duplicate_exists;
    if duplicate_exists then
      raise exception 'WHATSAPP_ALREADY_IN_USE';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_validate_store_identity on public.profiles;
create trigger profiles_validate_store_identity
before insert or update of slug, public_name, whatsapp
on public.profiles
for each row execute function public.validate_profile_store_identity();
