alter table public.profiles add column if not exists store_logo_path text;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('store-logos','store-logos',true,2097152,array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public=true,file_size_limit=2097152,allowed_mime_types=array['image/png','image/jpeg','image/webp'];

drop policy if exists "store logos public read" on storage.objects;
create policy "store logos public read" on storage.objects for select using (bucket_id='store-logos');

drop policy if exists "stores upload own logo" on storage.objects;
create policy "stores upload own logo" on storage.objects for insert to authenticated with check (bucket_id='store-logos' and (storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.profiles p where p.id=auth.uid() and p.seller_type='store'));

drop policy if exists "stores update own logo" on storage.objects;
create policy "stores update own logo" on storage.objects for update to authenticated using (bucket_id='store-logos' and (storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.profiles p where p.id=auth.uid() and p.seller_type='store')) with check (bucket_id='store-logos' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "stores delete own logo" on storage.objects;
create policy "stores delete own logo" on storage.objects for delete to authenticated using (bucket_id='store-logos' and (storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.profiles p where p.id=auth.uid() and p.seller_type='store'));
