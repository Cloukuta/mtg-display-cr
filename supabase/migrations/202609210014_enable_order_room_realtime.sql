-- Realtime Order Room v1
-- Publish every table whose changes must be visible immediately to buyer/seller.
-- Idempotent: safe when a table is already in supabase_realtime.

do $$
declare
  t text;
begin
  foreach t in array array['orders','order_messages','order_attachments','order_events','order_items']
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname='supabase_realtime'
        and schemaname='public'
        and tablename=t
    ) then
      execute format('alter publication supabase_realtime add table public.%I',t);
    end if;
  end loop;
end $$;
