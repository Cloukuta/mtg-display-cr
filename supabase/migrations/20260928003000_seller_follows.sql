create table if not exists public.seller_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, seller_id),
  constraint seller_follows_not_self check (follower_id <> seller_id)
);

alter table public.seller_follows enable row level security;

drop policy if exists "seller follows public read" on public.seller_follows;
create policy "seller follows public read" on public.seller_follows for select using (true);

drop policy if exists "seller follows owner insert" on public.seller_follows;
create policy "seller follows owner insert" on public.seller_follows for insert with check (auth.uid() = follower_id);

drop policy if exists "seller follows owner delete" on public.seller_follows;
create policy "seller follows owner delete" on public.seller_follows for delete using (auth.uid() = follower_id);

create index if not exists seller_follows_seller_id_idx on public.seller_follows(seller_id);
