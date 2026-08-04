'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useUserId } from '@/lib/hooks/useUserId';
import { useOrgRole } from '@/lib/hooks/useOrgRole';
import { useRealtimeQuery } from '@/lib/hooks/useRealtimeQuery';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState, PageHeader, Pagination, SearchToolbar, StatusBadge } from '@/components/ui/enterprise';
import { DataTableSkeleton } from '@/components/ui/DataTableSkeleton';
import { generateOrderNumber } from '@/lib/stock/movements';
import { writeAuditLog } from '@/lib/audit/write-audit-log';

// ── Types ────────────────────────────────────────────────────

interface VendorContact {
  id: string;
  vendor_id: string;
  name: string;
  role: string | null;
  phones: string[];
  email: string | null;
  is_primary: boolean;
}

interface VendorRow {
  id: string;
  vendor_id_display: string;
  company_name: string;
  gstin: string | null;
  payment_terms: string;
  remarks: string | null;
  is_active: boolean;
  created_at: string;
  vendor_contacts: VendorContact[];
  vendor_items: { count: number }[];
}

const PAYMENT_TERMS_OPTIONS = [
  'ADVANCE',
  'NET_7',
  'NET_15',
  'NET_30',
  'NET_45',
  'NET_60',
  'COD',
] as const;

// ── Zod Schema ───────────────────────────────────────────────

const vendorSchema = z.object({
  company_name: z.string().min(1, 'Company name is required'),
  gstin: z
    .string()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN format')
    .or(z.literal('')),
  payment_terms: z.string().min(1, 'Select payment terms'),
  remarks: z.string(),
  contact_name: z.string().min(1, 'Contact name is required'),
  contact_phone: z.string().min(10, 'Enter a valid phone number'),
  contact_email: z.string().email('Invalid email').or(z.literal('')),
});

type VendorFormValues = z.infer<typeof vendorSchema>;

const defaultValues: VendorFormValues = {
  company_name: '',
  gstin: '',
  payment_terms: 'NET_30',
  remarks: '',
  contact_name: '',
  contact_phone: '',
  contact_email: '',
};

// ── Helpers ──────────────────────────────────────────────────

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function formatPaymentTerms(raw: string): string {
  if (raw === 'COD') return 'COD';
  if (raw === 'ADVANCE') return 'Advance';
  return raw.replace('NET_', 'Net ') + ' days';
}

// ── Page Component ───────────────────────────────────────────

export default function VendorsPage() {
  const userId = useUserId();
  const { canDeleteVendorsCustomers } = useOrgRole();
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 300);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<VendorRow | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<string | null>(null);

  // ── Fetch vendors with contacts + items count ─────────────

  const fetchVendors = useCallback(async (): Promise<{ rows: VendorRow[]; total: number }> => {
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from('vendors')
      .select('*, vendor_contacts(*), vendor_items(count)', { count: 'exact' })
      .eq('user_id', userId!)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (debouncedSearch) {
      query = query.ilike('company_name', `%${debouncedSearch}%`);
    }

    const { data, error, count } = await query.range(from, to);
    if (error) throw error;
    return { rows: (data ?? []) as unknown as VendorRow[], total: count ?? 0 };
  }, [supabase, debouncedSearch, page, userId]);

  const { data: vendorsPage, isLoading } = useRealtimeQuery<{ rows: VendorRow[]; total: number }>(
    ['vendors', userId ?? '', debouncedSearch, page],
    'vendors',
    fetchVendors,
    !!userId,
  );

  const vendors = vendorsPage?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil((vendorsPage?.total ?? 0) / PAGE_SIZE));

  // ── Create mutation ───────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (values: VendorFormValues) => {
      if (!userId) throw new Error('Not authenticated');

      const vendorIdDisplay = await generateOrderNumber(userId, 'VEN');

      const { data: vendor, error: vendorErr } = await supabase
        .from('vendors')
        .insert({
          user_id: userId,
          vendor_id_display: vendorIdDisplay,
          company_name: values.company_name,
          gstin: values.gstin || null,
          payment_terms: values.payment_terms,
          remarks: values.remarks || null,
        })
        .select('id')
        .single();

      if (vendorErr) throw vendorErr;

      const { error: contactErr } = await supabase
        .from('vendor_contacts')
        .insert({
          user_id: userId,
          vendor_id: vendor.id,
          name: values.contact_name,
          phones: values.contact_phone ? [values.contact_phone] : [],
          email: values.contact_email || null,
          is_primary: true,
        });

      if (contactErr) throw contactErr;

      await writeAuditLog({
        userId,
        action: 'CREATE',
        entityType: 'vendor',
        entityId: vendor.id,
        newValues: {
          vendor_id_display: vendorIdDisplay,
          company_name: values.company_name,
          gstin: values.gstin || null,
          payment_terms: values.payment_terms,
        },
      });
    },
    onSuccess: () => {
      toast.success('Vendor created');
      void queryClient.invalidateQueries({ queryKey: ['vendors'] });
      closeModal();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Edit mutation ─────────────────────────────────────────

  const editMutation = useMutation({
    mutationFn: async ({
      vendorId,
      contactId,
      values,
    }: {
      vendorId: string;
      contactId: string | null;
      values: VendorFormValues;
    }) => {
      if (!userId) throw new Error('Not authenticated');

      const { error: vendorErr } = await supabase
        .from('vendors')
        .update({
          company_name: values.company_name,
          gstin: values.gstin || null,
          payment_terms: values.payment_terms,
          remarks: values.remarks || null,
        })
        .eq('id', vendorId);

      if (vendorErr) throw vendorErr;

      if (contactId) {
        const { error: contactErr } = await supabase
          .from('vendor_contacts')
          .update({
            name: values.contact_name,
            phones: values.contact_phone ? [values.contact_phone] : [],
            email: values.contact_email || null,
          })
          .eq('id', contactId);

        if (contactErr) throw contactErr;
      } else {
        const { error: contactErr } = await supabase
          .from('vendor_contacts')
          .insert({
            user_id: userId,
            vendor_id: vendorId,
            name: values.contact_name,
            phones: values.contact_phone ? [values.contact_phone] : [],
            email: values.contact_email || null,
            is_primary: true,
          });

        if (contactErr) throw contactErr;
      }

      await writeAuditLog({
        userId,
        action: 'UPDATE',
        entityType: 'vendor',
        entityId: vendorId,
        newValues: {
          company_name: values.company_name,
          gstin: values.gstin || null,
          payment_terms: values.payment_terms,
        },
      });
    },
    onSuccess: () => {
      toast.success('Vendor updated');
      void queryClient.invalidateQueries({ queryKey: ['vendors'] });
      closeModal();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Soft-delete mutation ──────────────────────────────────

  const deactivateMutation = useMutation({
    mutationFn: async (vendorId: string) => {
      if (!userId) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('vendors')
        .update({ is_active: false })
        .eq('id', vendorId);

      if (error) throw error;

      await writeAuditLog({
        userId,
        action: 'DELETE',
        entityType: 'vendor',
        entityId: vendorId,
        oldValues: { is_active: true },
        newValues: { is_active: false },
      });
    },
    onSuccess: () => {
      toast.success('Vendor deactivated');
      void queryClient.invalidateQueries({ queryKey: ['vendors'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Modal helpers ─────────────────────────────────────────

  function openCreate() {
    setEditingVendor(null);
    setModalOpen(true);
  }

  function openEdit(vendor: VendorRow) {
    setEditingVendor(vendor);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingVendor(null);
  }

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Vendors"
        description="Manage your supplier directory."
        actions={<Button onClick={openCreate}><Plus className="h-4 w-4" />Add Vendor</Button>}
      />

      {/* Search */}
      <SearchToolbar value={search} onChange={setSearch} placeholder="Search by company name…">
        <span className="text-xs text-muted-foreground">
          {vendors.length} vendor{vendors.length !== 1 ? 's' : ''}
        </span>
      </SearchToolbar>

      {/* Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-4">
            <DataTableSkeleton rows={5} cols={8} />
          </div>
        ) : vendors.length === 0 ? (
          <EmptyState title="No vendors yet" description="Add your first vendor to get started." action={<Button onClick={openCreate}><Plus className="h-4 w-4" />Add vendor</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-border bg-muted text-xs font-medium uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Vendor ID</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">GSTIN</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Payment Terms</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => {
                  const primary = v.vendor_contacts.find((c) => c.is_primary) ?? v.vendor_contacts[0] ?? null;
                  const itemCount = v.vendor_items[0]?.count ?? 0;

                  return (
                    <tr
                      key={v.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {v.vendor_id_display}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">
                          {v.company_name}
                        </p>
                        {v.remarks && (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {v.remarks}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-foreground">
                        {v.gstin ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        {primary ? (
                          <div>
                            <p className="text-foreground">{primary.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {primary.phones[0] ?? ''}
                              {primary.email ? ` · ${primary.email}` : ''}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {formatPaymentTerms(v.payment_terms)}
                      </td>
                      <td className="px-4 py-3 text-center text-foreground">
                        {itemCount}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status="ACTIVE" /></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(v)}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {canDeleteVendorsCustomers ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setConfirmDeactivate(v.id)}
                              title="Deactivate"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

      {/* Create / Edit Modal */}
      {modalOpen && (
        <VendorFormModal
          vendor={editingVendor}
          onClose={closeModal}
          onSubmitCreate={(v) => createMutation.mutate(v)}
          onSubmitEdit={(vendorId, contactId, v) =>
            editMutation.mutate({ vendorId, contactId, values: v })
          }
          isSubmitting={createMutation.isPending || editMutation.isPending}
        />
      )}

      {/* Deactivate confirmation */}
      <Dialog open={!!confirmDeactivate} onOpenChange={(open) => !open && setConfirmDeactivate(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Deactivate this vendor?</DialogTitle><DialogDescription>The vendor will be hidden from active lists but data is preserved.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeactivate(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deactivateMutation.isPending} onClick={() => { if (confirmDeactivate) deactivateMutation.mutate(confirmDeactivate); setConfirmDeactivate(null); }}>Deactivate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Modal Form Component ────────────────────────────────────

function VendorFormModal({
  vendor,
  onClose,
  onSubmitCreate,
  onSubmitEdit,
  isSubmitting,
}: {
  vendor: VendorRow | null;
  onClose: () => void;
  onSubmitCreate: (values: VendorFormValues) => void;
  onSubmitEdit: (vendorId: string, contactId: string | null, values: VendorFormValues) => void;
  isSubmitting: boolean;
}) {
  const isEdit = !!vendor;
  const primary =
    vendor?.vendor_contacts.find((c) => c.is_primary) ??
    vendor?.vendor_contacts[0] ??
    null;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VendorFormValues>({
    resolver: zodResolver(vendorSchema) as Resolver<VendorFormValues>,
    defaultValues: isEdit
      ? {
          company_name: vendor.company_name,
          gstin: vendor.gstin ?? '',
          payment_terms: vendor.payment_terms,
          remarks: vendor.remarks ?? '',
          contact_name: primary?.name ?? '',
          contact_phone: primary?.phones[0] ?? '',
          contact_email: primary?.email ?? '',
        }
      : defaultValues,
  });

  function onSubmit(values: VendorFormValues) {
    if (isEdit) {
      onSubmitEdit(vendor.id, primary?.id ?? null, values);
    } else {
      onSubmitCreate(values);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg bg-white shadow-xl"
        role="dialog"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            {isEdit ? 'Edit Vendor' : 'Add Vendor'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-6 py-5">
          {/* Company Name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Company Name *
            </label>
            <input
              {...register('company_name')}
              className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
            {errors.company_name && (
              <p className="mt-1 text-xs text-red-600">
                {errors.company_name.message}
              </p>
            )}
          </div>

          {/* GSTIN */}
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              GSTIN
            </label>
            <input
              {...register('gstin')}
              placeholder="22AAAAA0000A1Z5"
              className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-primary"
            />
            {errors.gstin && (
              <p className="mt-1 text-xs text-red-600">
                {errors.gstin.message}
              </p>
            )}
          </div>

          {/* Payment Terms */}
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Payment Terms *
            </label>
            <select
              {...register('payment_terms')}
              className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            >
              {PAYMENT_TERMS_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {formatPaymentTerms(t)}
                </option>
              ))}
            </select>
            {errors.payment_terms && (
              <p className="mt-1 text-xs text-red-600">
                {errors.payment_terms.message}
              </p>
            )}
          </div>

          {/* Remarks */}
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Remarks
            </label>
            <textarea
              {...register('remarks')}
              rows={2}
              className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>

          {/* Divider */}
          <div className="border-t border-border pt-3">
            <p className="text-sm font-medium text-muted-foreground">
              Primary Contact
            </p>
          </div>

          {/* Contact Name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Name *
            </label>
            <input
              {...register('contact_name')}
              className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
            {errors.contact_name && (
              <p className="mt-1 text-xs text-red-600">
                {errors.contact_name.message}
              </p>
            )}
          </div>

          {/* Contact Phone & Email */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Phone *
              </label>
              <input
                {...register('contact_phone')}
                placeholder="9876543210"
                className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
              {errors.contact_phone && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.contact_phone.message}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Email
              </label>
              <input
                {...register('contact_email')}
                type="email"
                placeholder="vendor@example.com"
                className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
              {errors.contact_email && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.contact_email.message}
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary/90 disabled:opacity-50"
            >
              {isSubmitting
                ? 'Saving…'
                : isEdit
                  ? 'Update Vendor'
                  : 'Create Vendor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
