-- Ensure newly created checkout orders immediately appear as seller actions.
-- The pending-sales/catalog UI intentionally uses response_required_from as the
-- source of truth for who must act next. Older create_checkout_order versions
-- can create inventory_confirmation orders with this field NULL.

update public.orders
set response_required_from = 'seller',
    response_required_at = coalesce(response_required_at, created_at, now()),
    updated_at = now()
where status = 'inventory_confirmation'
  and response_required_from is null;

create or replace function public.set_initial_order_response_required()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'inventory_confirmation' and new.response_required_from is null then
    new.response_required_from := 'seller';
    new.response_required_at := coalesce(new.response_required_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_initial_order_response_required on public.orders;
create trigger trg_set_initial_order_response_required
before insert or update of status, response_required_from on public.orders
for each row
execute function public.set_initial_order_response_required();
