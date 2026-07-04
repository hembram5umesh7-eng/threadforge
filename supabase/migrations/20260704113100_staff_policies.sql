
-- Step 2: staff permissions + helper functions

create or replace function public.is_store_staff(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role in ('admin', 'staff')
  );
$$;

create or replace function public.is_super_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = 'admin'
  );
$$;

-- Categories
drop policy if exists "categories_public_read" on public.categories;
create policy "categories_public_read" on public.categories for select
  using (active = true or public.is_store_staff(auth.uid()));

drop policy if exists "categories_admin_manage" on public.categories;
drop policy if exists "categories_staff_manage" on public.categories;
create policy "categories_staff_manage" on public.categories for all
  using (public.is_store_staff(auth.uid()))
  with check (public.is_store_staff(auth.uid()));

-- Products
drop policy if exists "products_admin_manage" on public.products;
drop policy if exists "products_staff_manage" on public.products;
create policy "products_staff_manage" on public.products for all
  using (public.is_store_staff(auth.uid()))
  with check (public.is_store_staff(auth.uid()));

drop policy if exists "products_public_read" on public.products;
create policy "products_public_read" on public.products for select
  using (active = true or public.is_store_staff(auth.uid()));

-- Variants
drop policy if exists "variants_admin_manage" on public.product_variants;
drop policy if exists "variants_staff_manage" on public.product_variants;
create policy "variants_staff_manage" on public.product_variants for all
  using (public.is_store_staff(auth.uid()))
  with check (public.is_store_staff(auth.uid()));

-- Manufacturers
drop policy if exists "manufacturers_select_admin_or_self" on public.manufacturers;
drop policy if exists "manufacturers_select_staff_or_self" on public.manufacturers;
create policy "manufacturers_select_staff_or_self" on public.manufacturers for select
  using (public.is_store_staff(auth.uid()) or user_id = auth.uid());

drop policy if exists "manufacturers_admin_manage" on public.manufacturers;
drop policy if exists "manufacturers_staff_manage" on public.manufacturers;
create policy "manufacturers_staff_manage" on public.manufacturers for all
  using (public.is_store_staff(auth.uid()))
  with check (public.is_store_staff(auth.uid()));

-- Orders
drop policy if exists "orders_select_own_or_admin_or_assigned" on public.orders;
drop policy if exists "orders_select_own_or_staff_or_assigned" on public.orders;
create policy "orders_select_own_or_staff_or_assigned" on public.orders for select using (
  user_id = auth.uid()
  or public.is_store_staff(auth.uid())
  or (public.has_role(auth.uid(), 'manufacturer')
      and manufacturer_id in (select id from public.manufacturers where user_id = auth.uid()))
);

drop policy if exists "orders_update_admin_or_assigned_manufacturer" on public.orders;
drop policy if exists "orders_update_staff_or_assigned_manufacturer" on public.orders;
create policy "orders_update_staff_or_assigned_manufacturer" on public.orders for update using (
  public.is_store_staff(auth.uid())
  or (public.has_role(auth.uid(), 'manufacturer')
      and manufacturer_id in (select id from public.manufacturers where user_id = auth.uid()))
);

-- Order items
drop policy if exists "order_items_select_via_order" on public.order_items;
create policy "order_items_select_via_order" on public.order_items for select using (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and (o.user_id = auth.uid()
        or public.is_store_staff(auth.uid())
        or (public.has_role(auth.uid(), 'manufacturer')
            and o.manufacturer_id in (select id from public.manufacturers where user_id = auth.uid())))
  )
);

-- Profiles
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
drop policy if exists "profiles_select_own_or_staff" on public.profiles;
create policy "profiles_select_own_or_staff" on public.profiles for select
  using (auth.uid() = id or public.is_store_staff(auth.uid()));

-- User roles
drop policy if exists "roles_select_own_or_admin" on public.user_roles;
drop policy if exists "roles_select_own_or_staff" on public.user_roles;
create policy "roles_select_own_or_staff" on public.user_roles for select
  using (user_id = auth.uid() or public.is_store_staff(auth.uid()));

drop policy if exists "roles_admin_manage" on public.user_roles;
drop policy if exists "roles_super_admin_manage" on public.user_roles;
create policy "roles_super_admin_manage" on public.user_roles for all
  using (public.is_super_admin(auth.uid()))
  with check (public.is_super_admin(auth.uid()));

-- Storage
drop policy if exists "product_images_admin_write" on storage.objects;
drop policy if exists "product_images_admin_update" on storage.objects;
drop policy if exists "product_images_admin_delete" on storage.objects;
drop policy if exists "product_images_staff_write" on storage.objects;
drop policy if exists "product_images_staff_update" on storage.objects;
drop policy if exists "product_images_staff_delete" on storage.objects;

create policy "product_images_staff_write" on storage.objects for insert
  with check (bucket_id = 'product-images' and public.is_store_staff(auth.uid()));
create policy "product_images_staff_update" on storage.objects for update
  using (bucket_id = 'product-images' and public.is_store_staff(auth.uid()));
create policy "product_images_staff_delete" on storage.objects for delete
  using (bucket_id = 'product-images' and public.is_store_staff(auth.uid()));

-- Payments
drop policy if exists "payments_select_own_or_admin" on public.payments;
drop policy if exists "payments_select_own_or_staff" on public.payments;
create policy "payments_select_own_or_staff" on public.payments for select using (
  exists (select 1 from public.orders o where o.id = payments.order_id
    and (o.user_id = auth.uid() or public.is_store_staff(auth.uid())))
);
