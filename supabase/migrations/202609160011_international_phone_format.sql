-- Allow profile phone numbers to be stored in normalized international E.164 form.
-- Existing digit-only values remain valid during the transition.

alter table public.profiles
  drop constraint if exists profiles_sinpe_mobile_format;

alter table public.profiles
  add constraint profiles_sinpe_mobile_format
  check (
    sinpe_mobile = ''
    or sinpe_mobile ~ '^\+[1-9][0-9]{6,14}$'
    or sinpe_mobile ~ '^[0-9]{8,15}$'
  );
