'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useUserId } from '@/lib/hooks/useUserId';
import { writeAuditLog } from '@/lib/audit/write-audit-log';
import { ItemImageField } from '@/components/inventory/ItemImageField';
import { uploadProductImage } from '@/lib/storage/product-image';

const schema = z.object({
  standardized_name: z.string().min(1, 'Name is required'),
  min_stock_level: z.number().min(0),
});

type FormValues = {
  standardized_name: string;
  min_stock_level: number;
};

export default function EditItemPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);
  const userId = useUserId();

  const [file, setFile] = useState<File | null>(null);
  const [clearImage, setClearImage] = useState(false);

  const { data: item, isLoading } = useQuery({
    queryKey: ['item', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('items')
        .select('id, standardized_name, min_stock_level, product_code, image_url')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      standardized_name: '',
      min_stock_level: 0,
    },
  });

  useEffect(() => {
    if (item) {
      form.reset({
        standardized_name: item.standardized_name,
        min_stock_level: item.min_stock_level ?? 0,
      });
      setFile(null);
      setClearImage(false);
    }
  }, [item, form]);

  const mutation = useMutation({
    mutationFn: async (body: FormValues) => {
      if (!userId) throw new Error('Not authenticated');

      let imageUrl: string | null | undefined = undefined;
      if (file) {
        imageUrl = await uploadProductImage({
          userId,
          itemId: id,
          file,
        });
      } else if (clearImage) {
        imageUrl = null;
      }

      const { error } = await supabase
        .from('items')
        .update({
          standardized_name: body.standardized_name,
          min_stock_level: body.min_stock_level,
          ...(imageUrl !== undefined ? { image_url: imageUrl } : {}),
        })
        .eq('id', id);
      if (error) throw error;

      await writeAuditLog({
        userId,
        action: 'UPDATE',
        entityType: 'item',
        entityId: id,
        newValues: {
          standardized_name: body.standardized_name,
          min_stock_level: body.min_stock_level,
          ...(imageUrl !== undefined ? { image_url: imageUrl } : {}),
        },
      });
    },
    onSuccess: () => {
      toast.success('Item updated');
      void queryClient.invalidateQueries({ queryKey: ['items'] });
      void queryClient.invalidateQueries({ queryKey: ['item', id] });
      router.push('/dashboard/inventory');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !item) {
    return (
      <div className="p-8 text-[#64748B]">
        {isLoading ? 'Loading…' : 'Item not found'}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link
        href="/dashboard/inventory"
        className="text-sm text-[#1E90FF] hover:underline"
      >
        ← Back
      </Link>
      <h1 className="text-2xl font-semibold text-[#0F172A]">Edit item</h1>
      <p className="text-sm text-[#64748B]">{item.product_code}</p>
      <form
        onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
        className="space-y-4 rounded-lg border border-[#E2E8F0] bg-white p-6"
      >
        <label className="block text-sm font-medium text-[#334155]">
          Name
          <input
            {...form.register('standardized_name')}
            className="mt-1 w-full rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2"
          />
        </label>
        <label className="block text-sm font-medium text-[#334155]">
          Minimum stock level
          <input
            type="number"
            step="any"
            {...form.register('min_stock_level', { valueAsNumber: true })}
            className="mt-1 w-full rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2"
          />
        </label>

        <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4">
          <ItemImageField
            currentUrl={clearImage ? null : item.image_url}
            file={file}
            onFileChange={(next) => {
              setFile(next);
              if (next) setClearImage(false);
              else if (!next && item.image_url) setClearImage(true);
            }}
            disabled={mutation.isPending}
          />
        </div>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-md bg-[#1E90FF] px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {mutation.isPending ? 'Saving…' : 'Save'}
        </button>
      </form>
    </div>
  );
}
