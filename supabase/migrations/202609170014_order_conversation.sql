-- MTG Display CR
-- Buyer order room: participant conversation + private attachments.
-- Files live in Supabase Storage; PostgreSQL stores metadata only.

create table if not exists public.order_messages (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now(),
  constraint order_messages_message_check check (char_length(btrim(message)) between 1 and 2000)
);

create index if not exists order_messages_order_created_idx
  on public.order_messages(order_id, created_at, id);

alter table public.order_messages enable row level security;

drop policy if exists "participants read order messages" on public.order_messages;
create policy "participants read order messages"
on public.order_messages for select to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_messages.order_id
      and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
  )
);

drop policy if exists "participants add order messages" on public.order_messages;
create policy "participants add order messages"
on public.order_messages for insert to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.orders o
    where o.id = order_messages.order_id
      and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
      and o.status not in ('completed','cancelled')
  )
);

create table if not exists public.order_attachments (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  attachment_type text not null check (attachment_type in ('payment_proof','shipment_proof','other')),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 5242880),
  created_at timestamptz not null default now()
);

create index if not exists order_attachments_order_created_idx
  on public.order_attachments(order_id, created_at, id);

alter table public.order_attachments enable row level security;

drop policy if exists "participants read order attachments" on public.order_attachments;
create policy "participants read order attachments"
on public.order_attachments for select to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_attachments.order_id
      and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
  )
);

drop policy if exists "participants add order attachments" on public.order_attachments;
create policy "participants add order attachments"
on public.order_attachments for insert to authenticated
with check (
  uploaded_by = auth.uid()
  and exists (
    select 1 from public.orders o
    where o.id = order_attachments.order_id
      and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
      and o.status not in ('completed','cancelled')
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'order-attachments',
  'order-attachments',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Storage path convention:
--   <order_id>/<user_id>/<random-file-name>
-- Database metadata and the order participant check provide the authoritative link.
drop policy if exists "participants upload order attachment files" on storage.objects;
create policy "participants upload order attachment files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'order-attachments'
  and (storage.foldername(name))[2] = auth.uid()::text
  and exists (
    select 1 from public.orders o
    where o.id::text = (storage.foldername(name))[1]
      and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
      and o.status not in ('completed','cancelled')
  )
);

drop policy if exists "participants read order attachment files" on storage.objects;
create policy "participants read order attachment files"
on storage.objects for select to authenticated
using (
  bucket_id = 'order-attachments'
  and exists (
    select 1 from public.orders o
    where o.id::text = (storage.foldername(name))[1]
      and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
  )
);

drop policy if exists "uploader deletes order attachment files" on storage.objects;
create policy "uploader deletes order attachment files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'order-attachments'
  and (storage.foldername(name))[2] = auth.uid()::text
);
