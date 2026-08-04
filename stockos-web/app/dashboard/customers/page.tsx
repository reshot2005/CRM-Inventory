'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { MessageSquare, Pencil, Plus, Trash2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRealtimeQuery } from '@/lib/hooks/useRealtimeQuery';
import { useUserId } from '@/lib/hooks/useUserId';
import { useOrgRole } from '@/lib/hooks/useOrgRole';
import { generateOrderNumber } from '@/lib/stock/movements';
import type { Tables } from '@/lib/supabase/database.types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTableSkeleton } from '@/components/ui/DataTableSkeleton';
import { CurrencyDisplay, EmptyState, PageHeader, Pagination, SearchToolbar, StatusBadge } from '@/components/ui/enterprise';
import { formatDateTime } from '@/lib/utils/format';
import { writeAuditLog } from '@/lib/audit/write-audit-log';

type Customer = Tables<'customers'>;
type CustomerActivity = Tables<'customer_activities'>;

const CUSTOMER_TYPES = ['INDIVIDUAL', 'BUSINESS'] as const;
type CustomerType = (typeof CUSTOMER_TYPES)[number];

const customerSchema = z.object({
  type: z.enum(CUSTOMER_TYPES),
  company_name: z.string().min(1, 'Company / name is required'),
  primary_contact: z.string().min(1, 'Primary contact is required'),
  phone: z.string().min(1, 'Phone number is required'),
  address: z.string(),
  gstin: z.string(),
  credit_limit: z.number().nonnegative('Credit limit must be ≥ 0').optional(),
});

type CustomerFormValues = {
  type: CustomerType;
  company_name: string;
  primary_contact: string;
  phone: string;
  address: string;
  gstin: string;
  credit_limit?: number;
};

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(handle);
  }, [value, ms]);
  return debounced;
}

export default function CustomersPage() {
  const userId = useUserId();
  const { canDeleteVendorsCustomers } = useOrgRole();
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 300);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [activityCustomer, setActivityCustomer] = useState<Customer | null>(null);
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const { data: customersPage, isLoading } = useRealtimeQuery<{ rows: Customer[]; total: number }>(
    ['customers', userId ?? '', debouncedSearch, page],
    'customers',
    async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('customers')
        .select('*', { count: 'exact' })
        .eq('user_id', userId!)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (debouncedSearch.trim()) {
        const q = debouncedSearch.trim();
        query = query.or(
          `company_name.ilike.%${q}%,primary_contact.ilike.%${q}%,customer_id_display.ilike.%${q}%`,
        );
      }

      const { data, error, count } = await query.range(from, to);
      if (error) throw error;
      return { rows: (data ?? []) as Customer[], total: count ?? 0 };
    },
    !!userId,
  );

  const customers = customersPage?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil((customersPage?.total ?? 0) / PAGE_SIZE));

  const { data: activities = [], isLoading: activitiesLoading } = useQuery({
    queryKey: ['customer_activities', activityCustomer?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_activities')
        .select('*')
        .eq('user_id', userId!)
        .eq('customer_id', activityCustomer!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as CustomerActivity[];
    },
    enabled: !!userId && !!activityCustomer,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      type: 'BUSINESS',
      company_name: '',
      primary_contact: '',
      phone: '',
      address: '',
      gstin: '',
      credit_limit: undefined,
    },
  });

  const openCreate = useCallback(() => {
    setEditing(null);
    reset({
      type: 'BUSINESS',
      company_name: '',
      primary_contact: '',
      phone: '',
      address: '',
      gstin: '',
      credit_limit: undefined,
    });
    setModalOpen(true);
  }, [reset]);

  const openEdit = useCallback(
    (customer: Customer) => {
      setEditing(customer);
      reset({
        type: (customer.type as CustomerType) ?? 'BUSINESS',
        company_name: customer.company_name ?? '',
        primary_contact: customer.primary_contact,
        phone: customer.phones?.[0] ?? '',
        address: customer.address ?? '',
        gstin: customer.gstin ?? '',
        credit_limit: customer.credit_limit ?? undefined,
      });
      setModalOpen(true);
    },
    [reset],
  );

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditing(null);
  }, []);

  const createMutation = useMutation({
    mutationFn: async (values: CustomerFormValues) => {
      if (!userId) throw new Error('Not authenticated');
      const customerIdDisplay = await generateOrderNumber(userId, 'CUS');

      const { data: customer, error } = await supabase.from('customers').insert({
        user_id: userId,
        customer_id_display: customerIdDisplay,
        type: values.type,
        company_name: values.company_name || null,
        primary_contact: values.primary_contact,
        phones: values.phone ? [values.phone] : [],
        address: values.address || null,
        gstin: values.gstin || null,
        credit_limit: values.credit_limit ?? null,
      }).select('id').single();
      if (error) throw error;

      await writeAuditLog({
        userId,
        action: 'CREATE',
        entityType: 'customer',
        entityId: customer.id,
        newValues: {
          customer_id_display: customerIdDisplay,
          type: values.type,
          primary_contact: values.primary_contact,
          company_name: values.company_name || null,
        },
      });
    },
    onSuccess: () => {
      toast.success('Customer created successfully');
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
      closeModal();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: CustomerFormValues }) => {
      if (!userId) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('customers')
        .update({
          type: values.type,
          company_name: values.company_name || null,
          primary_contact: values.primary_contact,
          phones: values.phone ? [values.phone] : [],
          address: values.address || null,
          gstin: values.gstin || null,
          credit_limit: values.credit_limit ?? null,
        })
        .eq('id', id)
        .eq('user_id', userId);
      if (error) throw error;

      await writeAuditLog({
        userId,
        action: 'UPDATE',
        entityType: 'customer',
        entityId: id,
        newValues: {
          type: values.type,
          primary_contact: values.primary_contact,
          company_name: values.company_name || null,
        },
      });
    },
    onSuccess: () => {
      toast.success('Customer updated');
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
      closeModal();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('customers')
        .update({ is_active: false })
        .eq('id', id)
        .eq('user_id', userId);
      if (error) throw error;

      await writeAuditLog({
        userId,
        action: 'DELETE',
        entityType: 'customer',
        entityId: id,
        oldValues: { is_active: true },
        newValues: { is_active: false },
      });
    },
    onSuccess: () => {
      toast.success('Customer deactivated');
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addNoteMutation = useMutation({
    mutationFn: async ({ customerId, content }: { customerId: string; content: string }) => {
      if (!userId) throw new Error('Not authenticated');
      const { error } = await supabase.from('customer_activities').insert({
        user_id: userId,
        customer_id: customerId,
        type: 'NOTE',
        content,
        created_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Note added');
      setNoteText('');
      void queryClient.invalidateQueries({ queryKey: ['customer_activities'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const onSubmit = handleSubmit((values) => {
    if (editing) {
      return updateMutation.mutateAsync({ id: editing.id, values });
    }
    return createMutation.mutateAsync(values);
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Customers"
        description="Manage your customers and their contact information."
        actions={<Button onClick={openCreate}><Plus className="h-4 w-4" />Add Customer</Button>}
      />

      <SearchToolbar value={search} onChange={setSearch} placeholder="Search by company name, contact, or customer ID…">
        <span className="text-xs text-muted-foreground">
          {customersPage?.total ?? 0} customer{(customersPage?.total ?? 0) !== 1 ? 's' : ''}
        </span>
      </SearchToolbar>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-4">
            <DataTableSkeleton rows={6} cols={8} />
          </div>
        ) : customers.length === 0 ? (
          <EmptyState
            title={debouncedSearch ? 'No matching customers' : 'No customers yet'}
            description={
              debouncedSearch
                ? 'Try adjusting your search term.'
                : 'Add your first customer to start managing your contacts.'
            }
            action={!debouncedSearch ? <Button onClick={openCreate}><Plus className="h-4 w-4" />Add customer</Button> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="border-b border-border bg-muted text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Customer ID</th>
                  <th className="px-4 py-3">Company / Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">GSTIN</th>
                  <th className="px-4 py-3 text-right">Credit Limit</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-border transition-colors hover:bg-muted last:border-0"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-muted-foreground">
                        {c.customer_id_display}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">
                        {c.company_name || c.primary_contact}
                      </p>
                      {c.company_name && (
                        <p className="text-xs text-muted-foreground">{c.primary_contact}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.type ?? 'BUSINESS'} />
                    </td>
                    <td className="px-4 py-3 text-foreground">{c.primary_contact}</td>
                    <td className="px-4 py-3 text-foreground">{c.phones?.[0] ?? '—'}</td>
                    <td className="px-4 py-3">
                      {c.gstin ? (
                        <span className="font-mono text-xs text-foreground">{c.gstin}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      {c.credit_limit != null ? <CurrencyDisplay value={c.credit_limit} /> : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setActivityCustomer(c)}
                          title="Activity log"
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)} title="Edit customer">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {canDeleteVendorsCustomers ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setConfirmDeleteId(c.id)}
                            title="Deactivate customer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

      {/* Activity log panel */}
      {activityCustomer && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-end bg-black/40"
          role="presentation"
          onClick={() => setActivityCustomer(null)}
        >
          <div
            className="flex h-full w-full max-w-md flex-col bg-card shadow-2xl"
            role="dialog"
            aria-label="Customer activity log"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="font-semibold text-foreground">
                  {activityCustomer.company_name || activityCustomer.primary_contact}
                </h2>
                <p className="font-mono text-xs text-muted-foreground">
                  {activityCustomer.customer_id_display}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActivityCustomer(null)}
                className="rounded p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="border-b border-border p-4">
              <label className="mb-1 block text-sm font-medium text-foreground">Add Note</label>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={3}
                placeholder="Enter a note about this customer…"
                className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <Button
                className="mt-2"
                size="sm"
                disabled={!noteText.trim() || addNoteMutation.isPending}
                onClick={() =>
                  addNoteMutation.mutate({
                    customerId: activityCustomer.id,
                    content: noteText.trim(),
                  })
                }
              >
                {addNoteMutation.isPending ? 'Saving…' : 'Add Note'}
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {activitiesLoading ? (
                <DataTableSkeleton rows={4} cols={1} />
              ) : activities.length === 0 ? (
                <EmptyState title="No activity yet" description="Add a note to start the activity log." />
              ) : (
                <ul className="space-y-3">
                  {activities.map((act) => (
                    <li key={act.id} className="rounded-lg border border-border bg-muted/40 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <StatusBadge status={act.type} />
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(act.created_at)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-foreground">{act.content}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[10vh]"
          role="presentation"
          onClick={closeModal}
        >
          <div
            className="relative w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl"
            role="dialog"
            aria-label={editing ? 'Edit customer' : 'Add customer'}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                {editing ? 'Edit Customer' : 'Add Customer'}
              </h2>
              <button type="button" onClick={closeModal} className="rounded p-1 text-muted-foreground hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <fieldset disabled={isSaving} className="space-y-4">
                <div>
                  <label htmlFor="cust-type" className="mb-1 block text-sm font-medium text-foreground">Type</label>
                  <select id="cust-type" {...register('type')} className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm">
                    <option value="BUSINESS">Business</option>
                    <option value="INDIVIDUAL">Individual</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="cust-company" className="mb-1 block text-sm font-medium text-foreground">Company / Name</label>
                  <input id="cust-company" {...register('company_name')} className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm" />
                  {errors.company_name && <p className="mt-1 text-xs text-red-600">{errors.company_name.message}</p>}
                </div>
                <div>
                  <label htmlFor="cust-contact" className="mb-1 block text-sm font-medium text-foreground">Primary Contact</label>
                  <input id="cust-contact" {...register('primary_contact')} className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm" />
                  {errors.primary_contact && <p className="mt-1 text-xs text-red-600">{errors.primary_contact.message}</p>}
                </div>
                <div>
                  <label htmlFor="cust-phone" className="mb-1 block text-sm font-medium text-foreground">Phone</label>
                  <input id="cust-phone" type="tel" {...register('phone')} className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm" />
                  {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>}
                </div>
                <div>
                  <label htmlFor="cust-address" className="mb-1 block text-sm font-medium text-foreground">Address</label>
                  <textarea id="cust-address" rows={2} {...register('address')} className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm" />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="cust-gstin" className="mb-1 block text-sm font-medium text-foreground">GSTIN</label>
                    <input id="cust-gstin" {...register('gstin')} placeholder="22AAAAA0000A1Z5" className="w-full rounded-md border border-border bg-muted px-3 py-2 font-mono text-sm" />
                  </div>
                  <div>
                    <label htmlFor="cust-credit" className="mb-1 block text-sm font-medium text-foreground">Credit Limit (₹)</label>
                    <input id="cust-credit" type="number" min={0} step={1} {...register('credit_limit')} className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm" />
                  </div>
                </div>
              </fieldset>
              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="outline" onClick={closeModal} disabled={isSaving}>Cancel</Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? 'Saving…' : editing ? 'Update Customer' : 'Create Customer'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm deactivation */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="font-semibold text-foreground">Deactivate Customer?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This customer will be hidden from lists but not permanently deleted.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => void deleteMutation.mutateAsync(confirmDeleteId).then(() => setConfirmDeleteId(null))}
              >
                {deleteMutation.isPending ? 'Deactivating…' : 'Deactivate'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
