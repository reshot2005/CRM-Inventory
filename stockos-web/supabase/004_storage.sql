-- ════════════════════════════════════════════════════════════
-- STOCKOS STORAGE POLICIES — Run in Supabase SQL Editor (Step 4)
-- Create buckets manually in Dashboard → Storage first:
--   product-images (PUBLIC, 5MB, image/*)
--   challans       (PRIVATE, 10MB, application/pdf)
--   vendor-docs    (PRIVATE, 10MB, application/pdf, image/*)
--   company-logos  (PUBLIC, 2MB, image/*)
-- ════════════════════════════════════════════════════════════

-- product-images
drop policy if exists "user_owns_product_images" on storage.objects;
create policy "user_owns_product_images"
  on storage.objects for all
  using (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- challans
drop policy if exists "user_owns_challans" on storage.objects;
create policy "user_owns_challans"
  on storage.objects for all
  using (bucket_id = 'challans' AND (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'challans' AND (storage.foldername(name))[1] = auth.uid()::text);

-- vendor-docs
drop policy if exists "user_owns_vendor_docs" on storage.objects;
create policy "user_owns_vendor_docs"
  on storage.objects for all
  using (bucket_id = 'vendor-docs' AND (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'vendor-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

-- company-logos
drop policy if exists "user_owns_company_logos" on storage.objects;
create policy "user_owns_company_logos"
  on storage.objects for all
  using (bucket_id = 'company-logos' AND (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'company-logos' AND (storage.foldername(name))[1] = auth.uid()::text);
