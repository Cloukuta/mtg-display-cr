-- Evidence Storage Lifecycle v1
-- Keep order history permanently, but allow binary evidence to be purged 14 days after completion.
-- IMPORTANT: actual Storage objects must be deleted through the Storage API, never by deleting storage.objects rows.

alter table public.order_attachments
  add column if not exists storage_deleted_at timestamptz,
  add column if not exists storage_delete_reason text;

create index if not exists order_attachments_storage_cleanup_idx
  on public.order_attachments(order_id,storage_deleted_at)
  where storage_deleted_at is null;

create or replace function public.evidence_cleanup_candidates(
  p_retention_days integer default 14,
  p_limit integer default 200
)
returns table(
  attachment_id bigint,
  order_id bigint,
  storage_path text,
  attachment_type text,
  size_bytes bigint,
  completed_at timestamptz
)
language sql
security definer
set search_path=public
as $$
  select
    a.id,
    a.order_id,
    a.storage_path,
    a.attachment_type,
    a.size_bytes,
    o.completed_at
  from public.order_attachments a
  join public.orders o on o.id=a.order_id
  where o.status='completed'
    and o.completed_at is not null
    and o.completed_at <= now() - make_interval(days => greatest(p_retention_days,1))
    and a.storage_deleted_at is null
    and a.storage_path is not null
    and a.attachment_type in ('package_proof','payment_proof','shipment_proof')
  order by o.completed_at,a.id
  limit least(greatest(p_limit,1),1000);
$$;

-- Service-side cleanup calls this only after Storage API remove() succeeds.
create or replace function public.mark_evidence_storage_deleted(
  p_attachment_ids bigint[],
  p_reason text default 'retention_14_days'
)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare v_count integer;
begin
  update public.order_attachments
  set storage_deleted_at=coalesce(storage_deleted_at,now()),
      storage_delete_reason=coalesce(storage_delete_reason,nullif(btrim(p_reason),''),'retention_14_days')
  where id=any(p_attachment_ids)
    and storage_deleted_at is null;
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;

revoke all on function public.evidence_cleanup_candidates(integer,integer) from public,anon,authenticated;
revoke all on function public.mark_evidence_storage_deleted(bigint[],text) from public,anon,authenticated;
grant execute on function public.evidence_cleanup_candidates(integer,integer) to service_role;
grant execute on function public.mark_evidence_storage_deleted(bigint[],text) to service_role;

comment on column public.order_attachments.storage_deleted_at is
'Timestamp when the binary evidence was deleted from Supabase Storage. The attachment row remains as historical metadata.';
comment on function public.evidence_cleanup_candidates(integer,integer) is
'Returns completed-order evidence eligible for Storage API deletion after the retention period.';
