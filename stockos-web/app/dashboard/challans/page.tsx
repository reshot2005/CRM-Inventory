'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { EmptyState, PageHeader, Pagination, SearchToolbar, StatusBadge } from '@/components/ui/enterprise';
import { Button } from '@/components/ui/button';
import { DataTableSkeleton } from '@/components/ui/DataTableSkeleton';
import { ChallanPdfAction } from '@/components/pdf/ChallanPdfAction';
import { createClient } from '@/lib/supabase/client';
import { useUserId } from '@/lib/hooks/useUserId';
import { useRealtimeQuery } from '@/lib/hooks/useRealtimeQuery';
import { generateOrderNumber } from '@/lib/stock/movements';
import { formatCurrency } from '@/lib/utils/format';
import { writeAuditLog } from '@/lib/audit/write-audit-log';

// ── Row shapes ──────────────────────────

interface CustomerEmbed {
  company_name: string;
  primary_contact: string | null;
  address: string | null;
}

interface SaleOrderEmbed {
  order_number: string;
  total_amount: number;
  status: string;
  customers: CustomerEmbed | null;
}

interface ChallanRow {
  id: string;
  user_id: string;
  challan_number: string;
  sale_order_id: string;
  from_address: string;
  to_address: string;
  vehicle_no: string;
  status: string;
  pdf_url: string | null;
  generated_at: string;
  sale_orders: SaleOrderEmbed | null;
}

interface DispatchedOrder {
  id: string;
  order_number: string;
  customer_id: string;
  total_amount: number;
  status: string;
  customers: CustomerEmbed | null;
}

interface LineItemRow {
  sale_order_id: string;
  item_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  items: { standardized_name: string; product_code: string } | null;
}

interface ProfileRow {
  company_name: string | null;
  company_address: string | null;
  company_gstin: string | null;
  logo_url: string | null;
}

// ── Zod schema ──────────────────────────

const challanSchema = z.object({
  sale_order_id: z.string().min(1, 'Select a sale order'),
  from_address: z.string().min(1, 'From address is required'),
  to_address: z.string().min(1, 'To address is required'),
  vehicle_no: z.string().min(1, 'Vehicle number is required'),
});

type ChallanFormValues = z.infer<typeof challanSchema>;

const PAGE_SIZE = 20;

// ── Component ───────────────────────────

export default function ChallansPage() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);

  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // ── Profile ──

  const { data: profile } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('company_name, company_address, company_gstin, logo_url')
        .eq('id', userId!)
        .single();
      if (error) throw error;
      return data as ProfileRow;
    },
    enabled: !!userId,
  });

  // ── Challans list (realtime) ──

  const { data: challansPage, isLoading } = useRealtimeQuery<{ rows: ChallanRow[]; total: number }>(
    ['delivery_challans', userId ?? '', page],
    'delivery_challans',
    async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error, count } = await supabase
        .from('delivery_challans')
        .select(
          '*, sale_orders(order_number, total_amount, status, customers(company_name, primary_contact, address))',
          { count: 'exact' },
        )
        .eq('user_id', userId!)
        .order('generated_at', { ascending: false })
        .range(from, to)
        .returns<ChallanRow[]>();
      if (error) throw error;
      return { rows: data ?? [], total: count ?? 0 };
    },
    !!userId,
  );

  const challans = challansPage?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil((challansPage?.total ?? 0) / PAGE_SIZE));

  // ── Dispatched sale orders (create-modal dropdown) ──

  const { data: dispatchedOrders } = useQuery({
    queryKey: ['dispatched_orders', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sale_orders')
        .select(
          'id, order_number, customer_id, total_amount, status, customers(company_name, primary_contact, address)',
        )
        .eq('user_id', userId!)
        .eq('status', 'DISPATCHED')
        .order('created_at', { ascending: false })
        .returns<DispatchedOrder[]>();
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId && showCreate,
  });

  // ── Line items for expanded challan ──

  const expandedChallan = challans?.find((c) => c.id === expandedId);

  const { data: lineItems, isLoading: linesLoading } = useQuery({
    queryKey: ['sale_order_lines', expandedChallan?.sale_order_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sale_order_lines')
        .select('sale_order_id, item_id, quantity, unit_price, total_price, items(standardized_name, product_code)')
        .eq('sale_order_id', expandedChallan!.sale_order_id)
        .returns<LineItemRow[]>();
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!expandedChallan?.sale_order_id,
  });

  // ── Filtered list ──

  const filtered = useMemo(() => {
    if (!challans) return [];
    if (!search.trim()) return challans;
    const q = search.toLowerCase();
    return challans.filter(
      (c) =>
        c.challan_number.toLowerCase().includes(q) ||
        (c.sale_orders?.order_number ?? '').toLowerCase().includes(q) ||
        (c.sale_orders?.customers?.company_name ?? '').toLowerCase().includes(q) ||
        c.vehicle_no.toLowerCase().includes(q),
    );
  }, [challans, search]);

  // ── Create challan mutation ──

  const createMutation = useMutation({
    mutationFn: async (values: ChallanFormValues) => {
      if (!userId) throw new Error('Not authenticated');
      const challanNumber = await generateOrderNumber(userId, 'DC');

      const { data: challan, error } = await supabase.from('delivery_challans').insert({
        user_id: userId,
        challan_number: challanNumber,
        sale_order_id: values.sale_order_id,
        from_address: values.from_address,
        to_address: values.to_address,
        vehicle_no: values.vehicle_no,
        status: 'DRAFT',
        generated_at: new Date().toISOString(),
      }).select('id').single();
      if (error) throw error;

      await writeAuditLog({
        userId,
        action: 'CREATE',
        entityType: 'delivery_challan',
        entityId: challan.id,
        newValues: {
          challan_number: challanNumber,
          sale_order_id: values.sale_order_id,
          status: 'DRAFT',
        },
      });
    },
    onSuccess: () => {
      toast.success('Delivery challan created');
      void queryClient.invalidateQueries({ queryKey: ['delivery_challans'] });
      setShowCreate(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Mark delivered mutation ──

  const deliverMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('delivery_challans')
        .update({ status: 'DELIVERED' })
        .eq('id', id);
      if (error) throw error;

      await writeAuditLog({
        userId,
        action: 'UPDATE',
        entityType: 'delivery_challan',
        entityId: id,
        oldValues: { status: 'DRAFT' },
        newValues: { status: 'DELIVERED' },
      });
    },
    onSuccess: () => {
      toast.success('Marked as delivered');
      void queryClient.invalidateQueries({ queryKey: ['delivery_challans'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── react-hook-form ──

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ChallanFormValues>({
    resolver: zodResolver(challanSchema),
    defaultValues: {
      sale_order_id: '',
      from_address: profile?.company_address ?? '',
      to_address: '',
      vehicle_no: '',
    },
  });

  useEffect(() => {
    if (profile?.company_address) {
      setValue('from_address', profile.company_address);
    }
  }, [profile, setValue]);

  const selectedOrderId = watch('sale_order_id');
  useEffect(() => {
    if (!selectedOrderId || !dispatchedOrders) return;
    const order = dispatchedOrders.find((o) => o.id === selectedOrderId);
    if (order?.customers?.address) {
      setValue('to_address', order.customers.address);
    }
  }, [selectedOrderId, dispatchedOrders, setValue]);

  const openCreateModal = useCallback(() => {
    reset({
      sale_order_id: '',
      from_address: profile?.company_address ?? '',
      to_address: '',
      vehicle_no: '',
    });
    setShowCreate(true);
  }, [reset, profile]);

  // ── Render ────────────────────────────

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Delivery Challans"
        description={`${filtered.length} challan${filtered.length !== 1 ? 's' : ''} found`}
        actions={<Button onClick={openCreateModal}><Plus className="h-4 w-4" />New Challan</Button>}
      />

      {/* Search bar */}
      <SearchToolbar value={search} onChange={setSearch} placeholder="Search challan no, order, customer, vehicle…" />

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="p-4">
            <DataTableSkeleton rows={6} cols={10} />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No challans yet"
            description="Create your first delivery challan from a dispatched sale order."
            action={<Button onClick={openCreateModal}><Plus className="h-4 w-4" />Create first challan</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="border-b border-border bg-muted text-xs font-medium uppercase text-muted-foreground">
                <tr>
                  <th className="w-10 px-3 py-3" />
                  <th className="px-4 py-3">Challan&nbsp;#</th>
                  <th className="px-4 py-3">Order&nbsp;#</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">From</th>
                  <th className="px-4 py-3">To</th>
                  <th className="px-4 py-3">Vehicle</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const isExpanded = expandedId === row.id;

                  return (
                    <Fragment key={row.id}>
                      <tr className="border-b border-border/70 last:border-0 hover:bg-muted/40">
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : row.id)}
                            className="text-muted-foreground transition-colors hover:text-foreground"
                          >
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs font-medium text-foreground">
                          {row.challan_number}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-foreground">
                          {row.sale_orders?.order_number ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-foreground">
                          {row.sale_orders?.customers?.company_name ?? '—'}
                        </td>
                        <td className="max-w-[130px] truncate px-4 py-3 text-foreground" title={row.from_address}>
                          {row.from_address}
                        </td>
                        <td className="max-w-[130px] truncate px-4 py-3 text-foreground" title={row.to_address}>
                          {row.to_address}
                        </td>
                        <td className="px-4 py-3 text-foreground">{row.vehicle_no}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                          {new Date(row.generated_at).toLocaleDateString('en-IN')}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <ChallanPdfAction challan={row} profile={profile} />
                            {row.status !== 'DELIVERED' && (
                              <button
                                type="button"
                                onClick={() => void deliverMutation.mutateAsync(row.id)}
                                disabled={deliverMutation.isPending}
                                className="text-xs text-emerald-600 hover:underline disabled:opacity-50"
                              >
                                Deliver
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded detail row */}
                      {isExpanded && (
                        <tr className="border-b border-border">
                          <td colSpan={10} className="bg-muted/40 px-8 py-5">
                            <div className="mb-3 flex items-center justify-between">
                              <h3 className="text-sm font-semibold text-foreground">
                                Sale Order Line Items
                              </h3>
                              {row.sale_orders && (
                                <span className="text-xs text-muted-foreground">
                                  Order total: {formatCurrency(row.sale_orders.total_amount)}
                                </span>
                              )}
                            </div>

                            {linesLoading ? (
                              <div className="space-y-2">
                                {Array.from({ length: 3 }, (_, i) => (
                                  <div key={i} className="h-8 animate-pulse rounded bg-muted" />
                                ))}
                              </div>
                            ) : !lineItems?.length ? (
                              <p className="text-sm text-muted-foreground">No line items found.</p>
                            ) : (
                              <table className="w-full text-left text-sm">
                                <thead className="text-xs font-medium uppercase text-muted-foreground">
                                  <tr>
                                    <th className="px-3 py-2">Sr.</th>
                                    <th className="px-3 py-2">Item Name</th>
                                    <th className="px-3 py-2">Code</th>
                                    <th className="px-3 py-2 text-right">Qty</th>
                                    <th className="px-3 py-2 text-right">Unit Price</th>
                                    <th className="px-3 py-2 text-right">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {lineItems.map((line, idx) => (
                                    <tr key={line.item_id} className="border-t border-border">
                                      <td className="px-3 py-2">{idx + 1}</td>
                                      <td className="px-3 py-2">
                                        {line.items?.standardized_name ?? '—'}
                                      </td>
                                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                                        {line.items?.product_code ?? '—'}
                                      </td>
                                      <td className="px-3 py-2 text-right">{line.quantity}</td>
                                      <td className="px-3 py-2 text-right">
                                        {formatCurrency(line.unit_price)}
                                      </td>
                                      <td className="px-3 py-2 text-right">
                                        {formatCurrency(line.total_price)}
                                      </td>
                                    </tr>
                                  ))}
                                  <tr className="border-t-2 border-border font-semibold">
                                    <td colSpan={5} className="px-3 py-2 text-right">
                                      Grand Total
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                      {formatCurrency(
                                        lineItems.reduce((s, l) => s + l.total_price, 0),
                                      )}
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

      {/* ── Create challan modal ── */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="w-full max-w-lg rounded-lg bg-card p-6 shadow-xl"
            role="dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                New Delivery Challan
              </h2>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleSubmit((v) => createMutation.mutate(v))}
              className="space-y-4"
            >
              {/* Sale order select */}
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Sale Order (Dispatched)
                </label>
                <select
                  {...register('sale_order_id')}
                  className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Select an order…</option>
                  {(dispatchedOrders ?? []).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.order_number} — {o.customers?.company_name ?? 'Unknown'} (
                      {formatCurrency(o.total_amount)})
                    </option>
                  ))}
                </select>
                {errors.sale_order_id && (
                  <p className="mt-1 text-xs text-red-600">{errors.sale_order_id.message}</p>
                )}
              </div>

              {/* From address */}
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  From Address
                </label>
                <textarea
                  {...register('from_address')}
                  rows={2}
                  className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {errors.from_address && (
                  <p className="mt-1 text-xs text-red-600">{errors.from_address.message}</p>
                )}
              </div>

              {/* To address */}
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  To Address
                </label>
                <textarea
                  {...register('to_address')}
                  rows={2}
                  className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {errors.to_address && (
                  <p className="mt-1 text-xs text-red-600">{errors.to_address.message}</p>
                )}
              </div>

              {/* Vehicle no */}
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Vehicle No
                </label>
                <input
                  {...register('vehicle_no')}
                  placeholder="MH-12-AB-1234"
                  className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {errors.vehicle_no && (
                  <p className="mt-1 text-xs text-red-600">{errors.vehicle_no.message}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary/90 disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Creating…' : 'Create Challan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
