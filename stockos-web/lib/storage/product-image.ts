import { createClient } from '@/lib/supabase/client';

/**
 * Upload a product image to the public `product-images` bucket and return its public URL.
 * Path: `{userId}/{itemId}/image.{ext}` (matches storage RLS folder = auth.uid()).
 */
export async function uploadProductImage(params: {
  userId: string;
  itemId: string;
  file: File;
}): Promise<string> {
  const supabase = createClient();
  const ext = params.file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${params.userId}/${params.itemId}/image.${ext}`;

  const { error } = await supabase.storage
    .from('product-images')
    .upload(path, params.file, {
      upsert: true,
      contentType: params.file.type || 'image/jpeg',
    });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from('product-images').getPublicUrl(path);
  if (!data?.publicUrl) throw new Error('Could not resolve public image URL');
  return data.publicUrl;
}
