'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useUserId } from '@/lib/hooks/useUserId';
import { useRealtimeQuery } from '@/lib/hooks/useRealtimeQuery';
import type { Tables } from '@/lib/supabase/database.types';
import { writeAuditLog } from '@/lib/audit/write-audit-log';
import { ItemImageField } from '@/components/inventory/ItemImageField';
import { uploadProductImage } from '@/lib/storage/product-image';

const categories = [
  'RAW_MATERIAL',
  'FINISHED_GOOD',
  'PACKAGING',
  'OTHER',
] as const;

const packagingTypes = [
  'BOX',
  'PACKETS',
  'BAGS',
  'ROLL',
  'SHEET',
  'SACKS',
  'OTHERS',
] as const;

const schema = z.object({
  standardized_name: z.string().min(1, 'Name is required'),
  product_code: z
    .string()
    .min(1, 'Product code is required')
    .regex(/^[A-Za-z0-9._-]+$/, 'Only letters, digits, dots, hyphens, underscores'),
  brand: z.string(),
  category: z.enum(categories),
  packaging_type: z.string(),
  packaging_size: z.string(),
  min_stock_level: z.number().min(0, 'Must be 0 or greater'),
});

type FormValues = {
  standardized_name: string;
  product_code: string;
  brand: string;
  category: (typeof categories)[number];
  packaging_type: string;
  packaging_size: string;
  min_stock_level: number;
};

export default function AddInventoryItemPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useUserId();
  const supabase = useMemo(() => createClient(), []);

  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [codeAvailable, setCodeAvailable] = useState<boolean | null>(null);
  const [checkingCode, setCheckingCode] = useState(false);
  const [step, setStep] = useState(0);

  const locationsQuery = useRealtimeQuery<Tables<'locations'>[]>(
    ['locations', userId ?? ''],
    'locations',
    async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
    !!userId,
  );

  const locations = locationsQuery.data ?? [];

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      standardized_name: '',
      product_code: '',
      brand: '',
      category: 'RAW_MATERIAL',
      packaging_type: '',
      packaging_size: '',
      min_stock_level: 0,
    },
  });

  async function checkCode() {
    const code = form.getValues('product_code').trim();
    if (!code || !userId) {
      toast.error('Enter a product code');
      return;
    }
    setCheckingCode(true);
    try {
      const { data } = await supabase
        .from('items')
        .select('id')
        .eq('product_code', code)
        .maybeSingle();

      const available = !data;
      setCodeAvailable(available);
      if (!available) toast.error('Code already in use');
    } catch {
      setCodeAvailable(null);
      toast.error('Could not validate code');
    } finally {
      setCheckingCode(false);
    }
  }

  const createItemMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!userId) throw new Error('Not authenticated');

      const pkg = values.packaging_type?.trim() || null;
      const validPkg =
        pkg && (packagingTypes as readonly string[]).includes(pkg) ? pkg : null;

      const { data: newItem, error: insertError } = await supabase
        .from('items')
        .insert({
          user_id: userId,
          standardized_name: values.standardized_name.trim(),
          product_code: values.product_code.trim(),
          brand: values.brand?.trim() || null,
          category: values.category,
          packaging_type: validPkg,
          packaging_size: values.packaging_size?.trim() || null,
          min_stock_level: values.min_stock_level,
        })
        .select('id')
        .single();

      if (insertError) throw new Error(insertError.message);

      const itemId = newItem.id;

      if (locations.length > 0) {
        const inventoryRows = locations.map((loc) => ({
          user_id: userId,
          location_id: loc.id,
          item_id: itemId,
          quantity: 0,
          reserved_qty: 0,
          unit_cost: 0,
        }));

        const { error: invError } = await supabase
          .from('inventory')
          .insert(inventoryRows);

        if (invError) {
          console.error('Failed to seed inventory rows:', invError.message);
        }
      }

      if (file) {
        setUploadProgress(10);
        try {
          const publicUrl = await uploadProductImage({
            userId,
            itemId,
            file,
          });
          setUploadProgress(70);
          await supabase
            .from('items')
            .update({ image_url: publicUrl })
            .eq('id', itemId);
          setUploadProgress(100);
        } catch (e) {
          toast.error(
            `Image upload failed: ${e instanceof Error ? e.message : 'unknown error'}`,
          );
        }
      }

      await writeAuditLog({
        userId,
        action: 'CREATE',
        entityType: 'item',
        entityId: itemId,
        newValues: {
          product_code: values.product_code.trim(),
          standardized_name: values.standardized_name.trim(),
          category: values.category,
        },
      });

      return itemId;
    },
    onSuccess: () => {
      toast.success('Item added successfully');
      void queryClient.invalidateQueries({ queryKey: ['items'] });
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
      router.push('/dashboard/inventory');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to add item');
    },
  });

  const onSubmit = (values: FormValues) => {
    createItemMutation.mutate(values);
  };

  const submitting = createItemMutation.isPending;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <Link
          href="/dashboard/inventory"
          className="text-sm text-[#1E90FF] hover:underline"
        >
          ← Back to inventory
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-[#0F172A]">
          Add inventory item
        </h1>
        <p className="text-sm text-[#64748B]">
          Step {step + 1} of 2 — all fields required except where noted.
        </p>
      </div>

      <div className="flex gap-2">
        {[0, 1].map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full ${
              s <= step ? 'bg-[#1E90FF]' : 'bg-[#E2E8F0]'
            }`}
          />
        ))}
      </div>

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6 rounded-lg border border-[#E2E8F0] bg-white p-6 shadow-sm"
      >
        {step === 0 && (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-[#334155]">
              Name
              <input
                {...form.register('standardized_name')}
                className="mt-1 w-full rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm"
                placeholder="e.g. Corrugated Box 12x10"
              />
              {form.formState.errors.standardized_name && (
                <p className="mt-1 text-xs text-red-600">
                  {form.formState.errors.standardized_name.message}
                </p>
              )}
            </label>

            <label className="block text-sm font-medium text-[#334155]">
              Product code
              <div className="mt-1 flex gap-2">
                <input
                  {...form.register('product_code')}
                  onBlur={() => void checkCode()}
                  className="flex-1 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm"
                  placeholder="e.g. CB-12X10"
                />
                <button
                  type="button"
                  onClick={() => void checkCode()}
                  disabled={checkingCode}
                  className="rounded-md border border-[#E2E8F0] px-3 text-sm disabled:opacity-50"
                >
                  {checkingCode ? '…' : 'Check'}
                </button>
              </div>
              {codeAvailable === true && (
                <p className="mt-1 text-xs text-emerald-600">Available</p>
              )}
              {codeAvailable === false && (
                <p className="mt-1 text-xs text-red-600">Already used</p>
              )}
              {form.formState.errors.product_code && (
                <p className="mt-1 text-xs text-red-600">
                  {form.formState.errors.product_code.message}
                </p>
              )}
            </label>

            <label className="block text-sm font-medium text-[#334155]">
              Category
              <select
                {...form.register('category')}
                className="mt-1 w-full rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-[#334155]">
              Brand (optional)
              <input
                {...form.register('brand')}
                className="mt-1 w-full rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm"
              />
            </label>

            <label className="block text-sm font-medium text-[#334155]">
              Packaging type (optional)
              <select
                {...form.register('packaging_type')}
                className="mt-1 w-full rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm"
              >
                <option value="">—</option>
                {packagingTypes.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-[#334155]">
              Packaging size (optional)
              <input
                {...form.register('packaging_size')}
                className="mt-1 w-full rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm"
                placeholder="e.g. 25kg, 500ml"
              />
            </label>

            <label className="block text-sm font-medium text-[#334155]">
              Minimum stock level
              <input
                type="number"
                step="any"
                {...form.register('min_stock_level', { valueAsNumber: true })}
                className="mt-1 w-full rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm"
              />
              {form.formState.errors.min_stock_level && (
                <p className="mt-1 text-xs text-red-600">
                  {form.formState.errors.min_stock_level.message}
                </p>
              )}
            </label>

            <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <ItemImageField
                file={file}
                onFileChange={setFile}
                disabled={submitting}
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <ItemImageField
                file={file}
                onFileChange={setFile}
                disabled={submitting}
                label="Product image (optional) — confirm or change before saving"
              />
              {uploadProgress > 0 && uploadProgress < 100 ? (
                <div className="mt-3 h-2 w-full rounded bg-[#E2E8F0]">
                  <div
                    className="h-2 rounded bg-[#1E90FF] transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              ) : null}
            </div>

            <div className="rounded-md bg-[#F8FAFC] p-4 text-sm text-[#334155]">
              <p className="font-medium text-[#0F172A]">Review</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-xs">
                <li>
                  <span className="font-medium">Name:</span>{' '}
                  {form.getValues('standardized_name') || '—'}
                </li>
                <li>
                  <span className="font-medium">Code:</span>{' '}
                  {form.getValues('product_code') || '—'}
                </li>
                <li>
                  <span className="font-medium">Category:</span>{' '}
                  {form.getValues('category').replace(/_/g, ' ')}
                </li>
                {form.getValues('brand') && (
                  <li>
                    <span className="font-medium">Brand:</span>{' '}
                    {form.getValues('brand')}
                  </li>
                )}
                {form.getValues('packaging_type') && (
                  <li>
                    <span className="font-medium">Packaging:</span>{' '}
                    {form.getValues('packaging_type')}{' '}
                    {form.getValues('packaging_size') || ''}
                  </li>
                )}
                <li>
                  <span className="font-medium">Min stock:</span>{' '}
                  {form.getValues('min_stock_level')}
                </li>
                <li>
                  <span className="font-medium">Image:</span>{' '}
                  {file ? file.name : 'None'}
                </li>
                <li>
                  <span className="font-medium">Locations:</span>{' '}
                  {locations.length} (inventory rows created at qty 0)
                </li>
              </ul>
            </div>
          </div>
        )}

        <div className="flex justify-between border-t border-[#E2E8F0] pt-4">
          <button
            type="button"
            disabled={step === 0}
            onClick={() => setStep(0)}
            className="rounded-md border border-[#E2E8F0] px-4 py-2 text-sm disabled:opacity-40"
          >
            Back
          </button>
          {step < 1 ? (
            <button
              type="button"
              onClick={async () => {
                const ok = await form.trigger([
                  'standardized_name',
                  'product_code',
                  'category',
                  'min_stock_level',
                ]);
                if (ok) setStep(1);
              }}
              className="rounded-md bg-[#1E90FF] px-4 py-2 text-sm text-white"
            >
              Next
            </button>
          ) : (
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-[#1E90FF] px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Add to inventory'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
