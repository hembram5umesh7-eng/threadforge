-- Shiprocket integration fields on orders
alter table public.orders
  add column if not exists shiprocket_order_id bigint,
  add column if not exists shiprocket_shipment_id bigint,
  add column if not exists courier_name text,
  add column if not exists shiprocket_label_url text;
