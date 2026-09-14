create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  public_name text not null default '',
  slug text not null,
  whatsapp text not null default '',
  location text not null default '',
  delivery_text text not null default '',
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint profiles_whatsapp_format check (whatsapp = '' or whatsapp ~ '^[0-9]{8,15}$')
);
create unique index profiles_slug_unique on public.profiles (lower(slug));

create table public.cards (
  scryfall_id uuid primary key,
  name text not null,
  set_code text not null,
  set_name text not null,
  collector_number text not null,
  colors text[] not null default '{}',
  rarity text not null default '',
  image_uri text,
  updated_at timestamptz not null default now(),
  unique (set_code, collector_number)
);

create table public.inventory_items (
  id bigint generated always as identity primary key,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  scryfall_id uuid not null references public.cards(scryfall_id),
  quantity integer not null default 1 check (quantity >= 0),
  condition text not null default 'NM' check (condition in ('NM','EX','VG','G','PL','PO')),
  language text not null default 'en',
  finish text not null default 'nonfoil' check (finish in ('nonfoil','foil','etched','surgefoil')),
  price_crc integer not null default 0 check (price_crc >= 0),
  notes text not null default '',
  available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (seller_id, scryfall_id, language, finish, condition)
);

create table public.import_jobs (
  id bigint generated always as identity primary key,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  format text not null default 'moxfield_csv',
  strategy text not null check (strategy in ('sum','replace','skip')),
  total_rows integer not null default 0,
  resolved_rows integer not null default 0,
  unresolved_rows integer not null default 0,
  status text not null default 'preview' check (status in ('preview','completed','failed')),
  created_at timestamptz not null default now()
);

create table public.import_rows (
  id bigint generated always as identity primary key,
  job_id bigint not null references public.import_jobs(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  row_number integer not null,
  raw_data jsonb not null default '{}',
  result text not null check (result in ('resolved','unresolved','inserted','updated','skipped')),
  error text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.cards enable row level security;
alter table public.inventory_items enable row level security;
alter table public.import_jobs enable row level security;
alter table public.import_rows enable row level security;

create policy "profiles public read published" on public.profiles for select using (published or auth.uid() = id);
create policy "profiles owner insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles owner update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles owner delete" on public.profiles for delete using (auth.uid() = id);

create policy "cards public catalog read" on public.cards for select using (
  exists (select 1 from public.inventory_items i join public.profiles p on p.id = i.seller_id where i.scryfall_id = cards.scryfall_id and i.available and i.quantity > 0 and p.published)
  or exists (select 1 from public.inventory_items i where i.scryfall_id = cards.scryfall_id and i.seller_id = auth.uid())
);
create policy "authenticated cards insert" on public.cards for insert to authenticated with check (true);
create policy "authenticated cards update" on public.cards for update to authenticated using (true) with check (true);

create policy "inventory public read available" on public.inventory_items for select using (
  (available and quantity > 0 and exists (select 1 from public.profiles p where p.id = seller_id and p.published)) or seller_id = auth.uid()
);
create policy "inventory owner insert" on public.inventory_items for insert with check (seller_id = auth.uid());
create policy "inventory owner update" on public.inventory_items for update using (seller_id = auth.uid()) with check (seller_id = auth.uid());
create policy "inventory owner delete" on public.inventory_items for delete using (seller_id = auth.uid());

create policy "jobs owner all" on public.import_jobs for all using (seller_id = auth.uid()) with check (seller_id = auth.uid());
create policy "rows owner all" on public.import_rows for all using (seller_id = auth.uid()) with check (seller_id = auth.uid());

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, public_name, slug)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), 'vendedor-' || left(replace(new.id::text, '-', ''), 8));
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

