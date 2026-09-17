-- Normalize legacy phone values before enforcing the new international format.
-- Existing digit-only WhatsApp/SINPE values were created before the international
-- phone selector. Costa Rica (+506) is used only to migrate those legacy values;
-- new values may use any supported international calling code.

-- Remove the legacy constraints first so existing rows can be normalized safely.
alter table public.profiles
  drop constraint if exists profiles_whatsapp_format;

alter table public.profiles
  drop constraint if exists profiles_sinpe_mobile_format;

-- Trim whitespace and normalize legacy WhatsApp values.
update public.profiles
set whatsapp = case
  when whatsapp is null or btrim(whatsapp) = '' then ''
  when btrim(whatsapp) ~ '^\+[1-9][0-9]{7,14}$' then btrim(whatsapp)
  when regexp_replace(whatsapp, '[^0-9]', '', 'g') ~ '^506[0-9]{8}$'
    then '+' || regexp_replace(whatsapp, '[^0-9]', '', 'g')
  when regexp_replace(whatsapp, '[^0-9]', '', 'g') ~ '^[0-9]{8}$'
    then '+506' || regexp_replace(whatsapp, '[^0-9]', '', 'g')
  else ''
end;

-- Trim whitespace and normalize legacy SINPE values.
update public.profiles
set sinpe_mobile = case
  when sinpe_mobile is null or btrim(sinpe_mobile) = '' then ''
  when btrim(sinpe_mobile) ~ '^\+[1-9][0-9]{7,14}$' then btrim(sinpe_mobile)
  when regexp_replace(sinpe_mobile, '[^0-9]', '', 'g') ~ '^506[0-9]{8}$'
    then '+' || regexp_replace(sinpe_mobile, '[^0-9]', '', 'g')
  when regexp_replace(sinpe_mobile, '[^0-9]', '', 'g') ~ '^[0-9]{8}$'
    then '+506' || regexp_replace(sinpe_mobile, '[^0-9]', '', 'g')
  else ''
end;

-- Enforce E.164-style storage going forward.
alter table public.profiles
  add constraint profiles_whatsapp_format
  check (
    whatsapp is null
    or whatsapp = ''
    or whatsapp ~ '^\+[1-9][0-9]{7,14}$'
  );

alter table public.profiles
  add constraint profiles_sinpe_mobile_format
  check (
    sinpe_mobile is null
    or sinpe_mobile = ''
    or sinpe_mobile ~ '^\+[1-9][0-9]{7,14}$'
  );
