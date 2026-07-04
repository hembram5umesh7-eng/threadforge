
-- Remove customization system (shopping-only focus)

alter table public.products
  drop column if exists mockup_front_url,
  drop column if exists mockup_back_url,
  drop column if exists customizable,
  drop column if exists allow_text,
  drop column if exists allow_image,
  drop column if exists text_price,
  drop column if exists image_price;

alter table public.order_items
  drop column if exists customization_price,
  drop column if exists design_data,
  drop column if exists preview_front_url,
  drop column if exists preview_back_url;

drop policy if exists "designs_public_read" on storage.objects;
drop policy if exists "designs_user_upload" on storage.objects;
drop policy if exists "designs_user_update_own" on storage.objects;
drop policy if exists "designs_user_delete_own" on storage.objects;
drop policy if exists "designs_auth_read" on storage.objects;
