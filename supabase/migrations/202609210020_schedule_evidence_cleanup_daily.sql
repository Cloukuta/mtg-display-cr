-- Daily evidence cleanup. Required Vault secrets are environment-specific:
-- evidence_cleanup_project_url
-- evidence_cleanup_anon_key
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if exists(select 1 from cron.job where jobname='cleanup-order-evidence-daily') then
    perform cron.unschedule('cleanup-order-evidence-daily');
  end if;
end $$;

select cron.schedule(
  'cleanup-order-evidence-daily',
  '20 9 * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='evidence_cleanup_project_url') || '/functions/v1/cleanup-order-evidence',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='evidence_cleanup_anon_key')
    ),
    body := jsonb_build_object('scheduled_at',now()),
    timeout_milliseconds := 15000
  );
  $job$
);
