-- ThreadForge sample catalog seed (run after migrations)

insert into public.products (name, slug, category, description, base_price, fabric, images, active)
values
  (
    'Classic Cotton Tee',
    'classic-cotton-tee',
    'tshirt',
    'Premium 180 GSM cotton tee. Soft, breathable, perfect for everyday wear.',
    599.00,
    '100% Cotton, 180 GSM',
    array['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800'],
    true
  ),
  (
    'Oversized Street Tee',
    'oversized-street-tee',
    'tshirt',
    'Relaxed fit oversized tee for bold streetwear looks.',
    699.00,
    'Cotton Blend, 200 GSM',
    array['https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800'],
    true
  ),
  (
    'Premium Pullover Hoodie',
    'premium-pullover-hoodie',
    'hoodie',
    'Fleece-lined hoodie with kangaroo pocket.',
    1299.00,
    'Cotton Fleece, 320 GSM',
    array['https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800'],
    true
  ),
  (
    'Zip-Up Hoodie',
    'zip-up-hoodie',
    'hoodie',
    'Full zip hoodie with premium metal zipper.',
    1499.00,
    'Cotton Fleece, 340 GSM',
    array['https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=800'],
    true
  ),
  (
    'Slim Fit Denim',
    'slim-fit-denim',
    'jeans',
    'Stretch denim with modern slim fit.',
    1599.00,
    'Stretch Denim',
    array['https://images.unsplash.com/photo-1542272604-787c3835535d?w=800'],
    true
  ),
  (
    'Formal Oxford Shirt',
    'formal-oxford-shirt',
    'shirt',
    'Crisp oxford cotton shirt for work and casual wear.',
    899.00,
    'Oxford Cotton',
    array['https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=800'],
    true
  )
on conflict (slug) do nothing;

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
