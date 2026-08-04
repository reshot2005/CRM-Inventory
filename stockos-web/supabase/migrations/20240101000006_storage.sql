-- StockOS Week 1 — Storage buckets + RLS (idempotent)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images', 'product-images', true, 5242880,
  array['image/jpeg','image/png','image/webp','image/gif']
) on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'challans', 'challans', false, 10485760,
  array['application/pdf']
) on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vendor-docs', 'vendor-docs', false, 10485760,
  array['application/pdf','image/jpeg','image/png']
) on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'company-logos', 'company-logos', true, 2097152,
  array['image/jpeg','image/png','image/webp']
) on conflict (id) do nothing;

drop policy if exists product_images_user on storage.objects;
drop policy if exists challans_user on storage.objects;
drop policy if exists vendor_docs_user on storage.objects;
drop policy if exists company_logos_user on storage.objects;

create policy product_images_user on storage.objects for all
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy challans_user on storage.objects for all
  using (bucket_id = 'challans' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'challans' and (storage.foldername(name))[1] = auth.uid()::text);

create policy vendor_docs_user on storage.objects for all
  using (bucket_id = 'vendor-docs' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'vendor-docs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy company_logos_user on storage.objects for all
  using (bucket_id = 'company-logos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'company-logos' and (storage.foldername(name))[1] = auth.uid()::text);
