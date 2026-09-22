-- Review v1 hotfix: allow the order page to react immediately when confirm_received
-- changes an order to completed. Safe to run if orders is already in the publication.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;
