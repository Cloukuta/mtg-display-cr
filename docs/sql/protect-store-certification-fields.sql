-- Display CR — protect administrative Store / Certified Store fields
-- Applied to Supabase production as migration: protect_store_certification_fields
-- Roadmap #171 / PR #172

create or replace function public.protect_profile_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
begin
  -- Trusted database/server contexts may manage certification fields.
  if jwt_role = 'service_role' or current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Public profile creation can never self-assign store/certification state.
    new.seller_type := 'individual';
    new.verification_status := 'unverified';
    new.verified_at := null;
    new.verified_by := null;
    new.verification_notes := null;
    new.verification_contact := null;
    return new;
  end if;

  if new.seller_type is distinct from old.seller_type
     or new.verification_status is distinct from old.verification_status
     or new.verified_at is distinct from old.verified_at
     or new.verified_by is distinct from old.verified_by
     or new.verification_notes is distinct from old.verification_notes
     or new.verification_contact is distinct from old.verification_contact then
    raise exception 'Store and certification fields are managed by Display CR administrators.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_admin_fields_trigger on public.profiles;
create trigger protect_profile_admin_fields_trigger
before insert or update on public.profiles
for each row execute function public.protect_profile_admin_fields();

comment on function public.protect_profile_admin_fields() is
  'Prevents public/authenticated clients from self-assigning store or certification state while allowing trusted service/admin contexts.';
