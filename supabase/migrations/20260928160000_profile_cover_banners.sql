alter table public.profiles
  add column if not exists cover_banner_preset text default 'portal',
  add column if not exists cover_banner_path text;

update public.profiles
set cover_banner_preset = 'portal'
where cover_banner_preset is null;

alter table public.profiles
  drop constraint if exists profiles_cover_banner_preset_check;

alter table public.profiles
  add constraint profiles_cover_banner_preset_check
  check (cover_banner_preset in ('portal','forest','mountain','ocean','ember','arcane'));

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('store-banners','store-banners',true,5242880,array['image/png','image/jpeg','image/webp'])
on conflict (id) do update
set public=true,file_size_limit=5242880,allowed_mime_types=array['image/png','image/jpeg','image/webp'];

drop policy if exists "store banners public read" on storage.objects;
create policy "store banners public read" on storage.objects for select using (bucket_id='store-banners');

drop policy if exists "store banners owner insert" on storage.objects;
create policy "store banners owner insert" on storage.objects for insert to authenticated
with check (bucket_id='store-banners' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "store banners owner update" on storage.objects;
create policy "store banners owner update" on storage.objects for update to authenticated
using (bucket_id='store-banners' and (storage.foldername(name))[1]=auth.uid()::text)
with check (bucket_id='store-banners' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "store banners owner delete" on storage.objects;
create policy "store banners owner delete" on storage.objects for delete to authenticated
using (bucket_id='store-banners' and (storage.foldername(name))[1]=auth.uid()::text);
