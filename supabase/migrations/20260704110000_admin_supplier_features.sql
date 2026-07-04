
-- Categories table + order notes for admin/supplier workflow

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text,
  image_url text,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;

create policy "categories_public_read" on public.categories for select
  using (active = true or public.has_role(auth.uid(), 'admin'));

create policy "categories_admin_manage" on public.categories for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

insert into public.categories (name, slug, sort_order, image_url, description) values
  ('T-Shirts', 'tshirt', 1, 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400', 'Casual and premium tees'),
  ('Hoodies', 'hoodie', 2, 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400', 'Warm hoodies and sweatshirts'),
  ('Jeans', 'jeans', 3, 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400', 'Denim and bottoms'),
  ('Shirts', 'shirt', 4, 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=400', 'Formal and casual shirts'),
  ('Other', 'other', 99, null, 'Miscellaneous items')
on conflict (slug) do nothing;

-- Allow dynamic category slugs on products (was enum)
alter table public.products alter column category type text using category::text;

alter table public.orders add column if not exists admin_notes text;
alter table public.orders add column if not exists supplier_notes text;
