-- Allow WhatsApp and SINPE phone values to be stored in international E.164-style format.
-- Examples: +50688888888, +14155552671
-- Empty strings remain allowed because these profile fields are optional.

alter table public.profiles
  drop constraint if exists profiles_whatsapp_format;

alter table public.profiles
  drop constraint if exists profiles_sinpe_mobile_format;

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
