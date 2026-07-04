
-- =========================================================
-- ENUMS
-- =========================================================
create type public.app_role as enum ('user', 'admin', 'manufacturer');
create type public.order_status as enum (
  'received', 'processing', 'sent_to_manufacturer', 'in_production',
  'completed', 'packed', 'shipped', 'delivered', 'cancelled'
);
create type public.payment_method as enum ('cod', 'razorpay', 'stripe');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');
create type public.product_category as enum ('tshirt', 'jeans', 'hoodie', 'shirt', 'other');

-- =========================================================
-- PROFILES
-- =========================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- =========================================================
-- USER ROLES (separate table to prevent privilege escalation)
-- =========================================================
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- =========================================================
-- MANUFACTURERS
-- =========================================================
create table public.manufacturers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  contact_email text,
  contact_phone text,
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.manufacturers enable row level security;

-- =========================================================
-- PRODUCTS
-- =========================================================
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  category product_category not null,
  description text,
  base_price numeric(10,2) not null check (base_price >= 0),
  fabric text,
  images text[] not null default '{}',
  mockup_front_url text,
  mockup_back_url text,
  customizable boolean not null default true,
  allow_text boolean not null default true,
  allow_image boolean not null default true,
  text_price numeric(10,2) not null default 49,
  image_price numeric(10,2) not null default 99,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.products enable row level security;
create index on public.products(category);
create index on public.products(active);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  size text not null,
  color text not null,
  color_hex text not null default '#000000',
  stock integer not null default 0,
  created_at timestamptz not null default now(),
  unique(product_id, size, color)
);
alter table public.product_variants enable row level security;
create index on public.product_variants(product_id);

-- =========================================================
-- ADDRESSES
-- =========================================================
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  phone text not null,
  line1 text not null,
  line2 text,
  city text not null,
  state text not null,
  pincode text not null,
  country text not null default 'India',
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.addresses enable row level security;
create index on public.addresses(user_id);

-- =========================================================
-- ORDERS
-- =========================================================
create sequence if not exists public.order_number_seq start 100001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null default ('TF' || nextval('public.order_number_seq')::text),
  user_id uuid not null references auth.users(id) on delete cascade,
  status order_status not null default 'received',
  payment_method payment_method not null default 'cod',
  payment_status payment_status not null default 'pending',
  subtotal numeric(10,2) not null,
  shipping_fee numeric(10,2) not null default 0,
  total numeric(10,2) not null,
  -- shipping snapshot
  ship_full_name text not null,
  ship_phone text not null,
  ship_line1 text not null,
  ship_line2 text,
  ship_city text not null,
  ship_state text not null,
  ship_pincode text not null,
  ship_country text not null default 'India',
  manufacturer_id uuid references public.manufacturers(id) on delete set null,
  tracking_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.orders enable row level security;
create index on public.orders(user_id);
create index on public.orders(manufacturer_id);
create index on public.orders(status);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  variant_id uuid references public.product_variants(id),
  product_name text not null,
  size text not null,
  color text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(10,2) not null,
  customization_price numeric(10,2) not null default 0,
  design_data jsonb,            -- canvas JSON: text elements, image elements, positions
  preview_front_url text,       -- generated preview images
  preview_back_url text,
  created_at timestamptz not null default now()
);
alter table public.order_items enable row level security;
create index on public.order_items(order_id);

-- =========================================================
-- PAYMENTS
-- =========================================================
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider payment_method not null,
  provider_payment_id text,
  amount numeric(10,2) not null,
  status payment_status not null default 'pending',
  created_at timestamptz not null default now()
);
alter table public.payments enable row level security;

-- =========================================================
-- TRIGGERS â€” updated_at + auto profile + auto user role
-- =========================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_products_updated before update on public.products
  for each row execute function public.set_updated_at();
create trigger trg_orders_updated before update on public.orders
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- RLS POLICIES
-- =========================================================

-- profiles
create policy "profiles_select_own_or_admin" on public.profiles for select
  using (auth.uid() = id or public.has_role(auth.uid(), 'admin'));
create policy "profiles_update_own" on public.profiles for update
  using (auth.uid() = id);
create policy "profiles_insert_self" on public.profiles for insert
  with check (auth.uid() = id);

-- user_roles
create policy "roles_select_own_or_admin" on public.user_roles for select
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "roles_admin_manage" on public.user_roles for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- manufacturers
create policy "manufacturers_select_admin_or_self" on public.manufacturers for select
  using (public.has_role(auth.uid(), 'admin') or user_id = auth.uid());
create policy "manufacturers_admin_manage" on public.manufacturers for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- products: public read of active, admin manage all
create policy "products_public_read" on public.products for select
  using (active = true or public.has_role(auth.uid(), 'admin'));
create policy "products_admin_manage" on public.products for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "variants_public_read" on public.product_variants for select using (true);
create policy "variants_admin_manage" on public.product_variants for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- addresses (own)
create policy "addresses_own" on public.addresses for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- orders
create policy "orders_select" on public.orders for select using (
  user_id = auth.uid()
  or public.has_role(auth.uid(), 'admin')
  or (public.has_role(auth.uid(), 'manufacturer')
      and manufacturer_id in (select id from public.manufacturers where user_id = auth.uid()))
);
create policy "orders_insert_self" on public.orders for insert
  with check (user_id = auth.uid());
create policy "orders_update_admin_or_assigned_manufacturer" on public.orders for update using (
  public.has_role(auth.uid(), 'admin')
  or (public.has_role(auth.uid(), 'manufacturer')
      and manufacturer_id in (select id from public.manufacturers where user_id = auth.uid()))
);

-- order items
create policy "order_items_select" on public.order_items for select using (
  exists(
    select 1 from public.orders o where o.id = order_id and (
      o.user_id = auth.uid()
      or public.has_role(auth.uid(), 'admin')
      or (public.has_role(auth.uid(), 'manufacturer')
          and o.manufacturer_id in (select id from public.manufacturers where user_id = auth.uid()))
    )
  )
);
create policy "order_items_insert_own_order" on public.order_items for insert with check (
  exists(select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
);

-- payments
create policy "payments_select_own_or_admin" on public.payments for select using (
  exists(select 1 from public.orders o where o.id = order_id
    and (o.user_id = auth.uid() or public.has_role(auth.uid(), 'admin')))
);
create policy "payments_insert_own" on public.payments for insert with check (
  exists(select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
);

-- =========================================================
-- REALTIME
-- =========================================================
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.order_items;

-- =========================================================
-- STORAGE BUCKETS
-- =========================================================
insert into storage.buckets (id, name, public) values
  ('product-images', 'product-images', true),
  ('custom-designs', 'custom-designs', true)
on conflict (id) do nothing;

create policy "product_images_public_read" on storage.objects for select
  using (bucket_id = 'product-images');
create policy "product_images_admin_write" on storage.objects for insert
  with check (bucket_id = 'product-images' and public.has_role(auth.uid(), 'admin'));
create policy "product_images_admin_update" on storage.objects for update
  using (bucket_id = 'product-images' and public.has_role(auth.uid(), 'admin'));
create policy "product_images_admin_delete" on storage.objects for delete
  using (bucket_id = 'product-images' and public.has_role(auth.uid(), 'admin'));

create policy "designs_public_read" on storage.objects for select
  using (bucket_id = 'custom-designs');
create policy "designs_user_upload" on storage.objects for insert
  with check (bucket_id = 'custom-designs' and auth.uid() is not null);
create policy "designs_user_update_own" on storage.objects for update
  using (bucket_id = 'custom-designs' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "designs_user_delete_own" on storage.objects for delete
  using (bucket_id = 'custom-designs' and auth.uid()::text = (storage.foldername(name))[1]);

-- Lock search_path on trigger helpers
alter function public.set_updated_at() set search_path = public;
alter function public.handle_new_user() set search_path = public;

-- Revoke public/anon execute on internal functions; only authenticated may call has_role
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Tighten storage SELECT: replace permissive read with authenticated-only listing.
-- Public file URLs from `public` buckets remain accessible via the CDN even without SELECT.
drop policy if exists "product_images_public_read" on storage.objects;
drop policy if exists "designs_public_read" on storage.objects;

create policy "product_images_auth_read" on storage.objects for select
  to authenticated using (bucket_id = 'product-images');

create policy "designs_auth_read" on storage.objects for select
  to authenticated using (bucket_id = 'custom-designs');
-- ThreadForge sample catalog seed (run after migrations)
-- Safe to re-run: uses ON CONFLICT DO NOTHING where possible

insert into public.products (name, slug, category, description, base_price, fabric, images, customizable, allow_text, allow_image, text_price, image_price, active)
values
  (
    'Classic Cotton Tee',
    'classic-cotton-tee',
    'tshirt',
    'Premium 180 GSM cotton tee. Soft, breathable, perfect for custom prints.',
    599.00,
    '100% Cotton, 180 GSM',
    array['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800'],
    true, true, true, 49, 99, true
  ),
  (
    'Oversized Street Tee',
    'oversized-street-tee',
    'tshirt',
    'Relaxed fit oversized tee for bold streetwear designs.',
    699.00,
    'Cotton Blend, 200 GSM',
    array['https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800'],
    true, true, true, 49, 99, true
  ),
  (
    'Premium Pullover Hoodie',
    'premium-pullover-hoodie',
    'hoodie',
    'Fleece-lined hoodie with kangaroo pocket. Ideal for logo prints.',
    1299.00,
    'Cotton Fleece, 320 GSM',
    array['https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800'],
    true, true, true, 49, 99, true
  ),
  (
    'Zip-Up Hoodie',
    'zip-up-hoodie',
    'hoodie',
    'Full zip hoodie with premium metal zipper.',
    1499.00,
    'Cotton Fleece, 340 GSM',
    array['https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=800'],
    true, true, true, 49, 99, true
  ),
  (
    'Slim Fit Denim',
    'slim-fit-denim',
    'jeans',
    'Stretch denim with modern slim fit. Custom embroidery ready.',
    1599.00,
    'Stretch Denim',
    array['https://images.unsplash.com/photo-1542272604-787c3835535d?w=800'],
    false, false, false, 49, 99, true
  ),
  (
    'Formal Oxford Shirt',
    'formal-oxford-shirt',
    'shirt',
    'Crisp oxford cotton shirt. Monogram-friendly chest panel.',
    899.00,
    'Oxford Cotton',
    array['https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=800'],
    true, true, true, 49, 99, true
  )
on conflict (slug) do nothing;

-- Variants for each product
insert into public.product_variants (product_id, size, color, color_hex, stock)
select p.id, v.size, v.color, v.color_hex, v.stock
from public.products p
cross join lateral (
  values
    ('S', 'White', '#FFFFFF', 50),
    ('M', 'White', '#FFFFFF', 50),
    ('L', 'White', '#FFFFFF', 50),
    ('XL', 'White', '#FFFFFF', 40),
    ('M', 'Black', '#111111', 50),
    ('L', 'Black', '#111111', 50)
) as v(size, color, color_hex, stock)
where p.slug in (
  'classic-cotton-tee',
  'oversized-street-tee',
  'premium-pullover-hoodie',
  'zip-up-hoodie',
  'slim-fit-denim',
  'formal-oxford-shirt'
)
on conflict (product_id, size, color) do nothing;

-- Sample manufacturer
insert into public.manufacturers (name, contact_email, contact_phone, address, active)
select
  'StitchWorks India',
  'orders@stitchworks.in',
  '+91-9876543210',
  'Plot 12, Industrial Area, Surat, Gujarat',
  true
where not exists (
  select 1 from public.manufacturers where name = 'StitchWorks India'
);
