'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  useForm,
  useFieldArray,
  type Resolver,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ClipboardList, PackageCheck, Plus } from 'lucide-react';
import { CurrencyDisplay, EmptyState, PageHeader, Pagination, StatusBadge } from '@/components/ui/enterprise';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { useUserId } from '@/lib/hooks/useUserId';
import { useRealtimeQuery } from '@/lib/hooks/useRealtimeQuery';
import { LOOKUP_KEYS } from '@/lib/query/lookups';
import type { Tables } from '@/lib/supabase/database.types';
import {
  generateOrderNumber,
  processStockMovement,
} from '@/lib/stock/movements';
import { insertNotification } from '@/lib/stock/manufacturing';
import { formatCurrency } from '@/lib/utils/format';
import { useLocations } from '@/lib/hooks/useLocations';
import { writeAuditLog } from '@/lib/audit/write-audit-log';

/* ───────────────────── types ───────────────────── */

type POStatus =
  | 'DRAFT'
  | 'SENT'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED';

interface POWithVendor extends Tables<'purchase_orders'> {
  vendors: { company_name: string; gstin: string | null } | null;
}

interface POLineWithItem extends Tables<'purchase_order_lines'> {
  items: {
    standardized_name: string;
    product_code: string;
    unit: string | null;
  } | null;
}

/* ───────────────────── zod schema ───────────────────── */

const lineSchema = z.object({
  item_id: z.string().min(1, 'Select an item'),
  ordered_qty: z.number().min(1, 'Qty must be ≥ 1'),
  unit_price: z.number().min(0, 'Price must be ≥ 0'),
});

const poSchema = z.object({
  vendor_id: z.string().min(1, 'Select a vendor'),
  expected_date: z.string(),
  notes: z.string(),
  lines: z.array(lineSchema).min(1, 'Add at least one line item'),
});

type POFormValues = {
  vendor_id: string;
  expected_date: string;
  notes: string;
  lines: Array<{ item_id: string; ordered_qty: number; unit_price: number }>;
};

/* ───────────────────── page component ───────────────────── */

export default function PurchaseOrdersPage() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);

  const [showCreate, setShowCreate] = useState(false);
  const [expandedPO, setExpandedPO] = useState<string | null>(null);
  const [receivingPO, setReceivingPO] = useState<string | null>(null);
  const [receiveLocationId, setReceiveLocationId] = useState('');
  const [receiveQtys, setReceiveQtys] = useState<Record<string, number>>({});

  /* ── fetch POs (paginated) ── */
  const [poPage, setPoPage] = useState(1);
  const PO_PAGE_SIZE = 20;

  const posQuery = useRealtimeQuery<{ rows: POWithVendor[]; total: number }>(
    ['purchase_orders', userId ?? '', poPage],
    'purchase_orders',
    async () => {
      const from = (poPage - 1) * PO_PAGE_SIZE;
      const to = from + PO_PAGE_SIZE - 1;
      const { data, error, count } = await supabase
        .from('purchase_orders')
        .select('*, vendors(company_name, gstin)', { count: 'exact' })
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
        .range(from, to);
      if (error) throw error;
      return {
        rows: (data ?? []) as unknown as POWithVendor[],
        total: count ?? 0,
      };
    },
    !!userId,
  );

  const purchaseOrders = posQuery.data?.rows ?? [];
  const poTotalPages = Math.max(1, Math.ceil((posQuery.data?.total ?? 0) / PO_PAGE_SIZE));

  /* ── fetch vendors ── */
  const vendorsQuery = useRealtimeQuery<Tables<'vendors'>[]>(
    LOOKUP_KEYS.vendors,
    'vendors',
    async () => {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('is_active', true)
        .order('company_name');
      if (error) throw error;
      return data ?? [];
    },
    !!userId && showCreate,
  );

  const vendors = vendorsQuery.data ?? [];

  /* ── fetch items ── */
  const itemsQuery = useRealtimeQuery<Tables<'items'>[]>(
    LOOKUP_KEYS.items,
    'items',
    async () => {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('is_active', true)
        .order('standardized_name');
      if (error) throw error;
      return data ?? [];
    },
    !!userId && showCreate,
  );

  const items = itemsQuery.data ?? [];

  const locationsQuery = useLocations(userId);
  const locations = locationsQuery.data ?? [];

  /* ── fetch lines for expanded PO ── */
  const linesQuery = useRealtimeQuery<POLineWithItem[]>(
    ['po_lines', expandedPO ?? ''],
    'purchase_order_lines',
    async () => {
      if (!expandedPO) return [];
      const { data, error } = await supabase
        .from('purchase_order_lines')
        .select('*, items(standardized_name, product_code)')
        .eq('purchase_order_id', expandedPO);
      if (error) throw error;
      return (data ?? []) as unknown as POLineWithItem[];
    },
    !!expandedPO,
  );

  const poLines = linesQuery.data ?? [];

  /* ── form ── */
  const form = useForm<POFormValues>({
    resolver: zodResolver(poSchema) as Resolver<POFormValues>,
    defaultValues: {
      vendor_id: '',
      expected_date: '',
      notes: '',
      lines: [{ item_id: '', ordered_qty: 1, unit_price: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'lines',
  });

  const watchedLines = form.watch('lines');
  const formTotal = watchedLines.reduce(
    (sum, l) => sum + (Number(l.ordered_qty) || 0) * (Number(l.unit_price) || 0),
    0,
  );

  /* ── create PO mutation ── */
  const createPOMutation = useMutation({
    mutationFn: async (values: POFormValues) => {
      if (!userId) throw new Error('Not authenticated');

      const poNumber = await generateOrderNumber(userId, 'PO');
      const totalAmount = values.lines.reduce(
        (s, l) => s + l.ordered_qty * l.unit_price,
        0,
      );

      const { data: po, error: poErr } = await supabase
        .from('purchase_orders')
        .insert({
          user_id: userId,
          po_number: poNumber,
          vendor_id: values.vendor_id,
          status: 'DRAFT',
          expected_date: values.expected_date || null,
          total_amount: totalAmount,
          notes: values.notes?.trim() || null,
        })
        .select('id, po_number')
        .single();

      if (poErr) throw new Error(poErr.message);

      const lineRows = values.lines.map((l) => ({
        user_id: userId,
        purchase_order_id: po.id,
        item_id: l.item_id,
        ordered_qty: l.ordered_qty,
        received_qty: 0,
        unit_price: l.unit_price,
      }));

      const { error: linesErr } = await supabase
        .from('purchase_order_lines')
        .insert(lineRows);

      if (linesErr) throw new Error(linesErr.message);

      await writeAuditLog({
        userId,
        action: 'CREATE',
        entityType: 'purchase_order',
        entityId: po.id,
        newValues: {
          po_number: po.po_number,
          vendor_id: values.vendor_id,
          status: 'DRAFT',
          total_amount: totalAmount,
          line_count: values.lines.length,
        },
      });

      return po;
    },
    onSuccess: (po) => {
      toast.success(`Purchase order ${po.po_number} created`);
      setShowCreate(false);
      form.reset();
      void queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create PO'),
  });

  /* ── receive stock mutation — MUST use process_stock_movement ── */
  const receiveStockMutation = useMutation({
    mutationFn: async (poId: string) => {
      if (!userId) throw new Error('Not authenticated');
      const locationId = receiveLocationId || locations[0]?.id;
      if (!locationId) throw new Error('No locations found — create one first');

      const { data: po, error: poErr } = await supabase
        .from('purchase_orders')
        .select('id, po_number')
        .eq('id', poId)
        .eq('user_id', userId)
        .single();
      if (poErr || !po) throw new Error('PO not found');

      const { data: lines, error: linesErr } = await supabase
        .from('purchase_order_lines')
        .select('*')
        .eq('purchase_order_id', poId)
        .eq('user_id', userId);

      if (linesErr) throw new Error(linesErr.message);
      if (!lines || lines.length === 0) throw new Error('No lines on this PO');

      const toReceive = lines
        .map((line) => {
          const remaining = Number(line.ordered_qty) - Number(line.received_qty);
          const qty =
            receiveQtys[line.id] !== undefined
              ? Number(receiveQtys[line.id])
              : remaining;
          return { line, qty: Math.min(Math.max(0, qty), remaining) };
        })
        .filter((x) => x.qty > 0);

      if (toReceive.length === 0) throw new Error('Enter quantities to receive');

      const locName =
        locations.find((l) => l.id === locationId)?.name ?? 'selected location';

      for (const { line, qty } of toReceive) {
        await processStockMovement({
          userId,
          locationId,
          itemId: line.item_id,
          movementType: 'PURCHASE_RECEIVE',
          quantity: qty,
          unitCost: line.unit_price,
          referenceType: 'PURCHASE_ORDER',
          referenceId: poId,
          notes: `Received against ${po.po_number}`,
          createdBy: userId,
        });

        const { error: updErr } = await supabase
          .from('purchase_order_lines')
          .update({ received_qty: Number(line.received_qty) + qty })
          .eq('id', line.id)
          .eq('user_id', userId);
        if (updErr) throw new Error(updErr.message);
      }

      const { data: updatedLines } = await supabase
        .from('purchase_order_lines')
        .select('ordered_qty, received_qty')
        .eq('purchase_order_id', poId);

      const allReceived = (updatedLines ?? []).every(
        (l) => Number(l.received_qty) >= Number(l.ordered_qty),
      );
      const someReceived = (updatedLines ?? []).some(
        (l) => Number(l.received_qty) > 0,
      );

      const newStatus: POStatus = allReceived
        ? 'RECEIVED'
        : someReceived
          ? 'PARTIALLY_RECEIVED'
          : 'SENT';

      const { error: stErr } = await supabase
        .from('purchase_orders')
        .update({ status: newStatus })
        .eq('id', poId)
        .eq('user_id', userId);
      if (stErr) throw new Error(stErr.message);

      await writeAuditLog({
        userId,
        action: 'UPDATE',
        entityType: 'purchase_order',
        entityId: poId,
        newValues: {
          po_number: po.po_number,
          status: newStatus,
          location_id: locationId,
          lines_received: toReceive.length,
        },
      });

      return locName;
    },
    onSuccess: (locName) => {
      toast.success(`Stock received. Inventory updated at ${locName}.`);
      setReceivingPO(null);
      setReceiveQtys({});
      if (userId) {
        void insertNotification({
          userId,
          type: 'PO_RECEIVED',
          title: 'Purchase order received',
          body: `Stock received at ${locName}`,
          link: '/dashboard/purchase-orders',
        });
      }
      void queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      void queryClient.invalidateQueries({ queryKey: ['po_lines'] });
      void queryClient.invalidateQueries({ queryKey: ['items'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      void queryClient.invalidateQueries({ queryKey: ['low-stock'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-ledger'] });
      void queryClient.invalidateQueries({ queryKey: ['receive-pos'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to receive stock'),
  });

  const markSentMutation = useMutation({
    mutationFn: async (poId: string) => {
      if (!userId) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('purchase_orders')
        .update({ status: 'SENT' })
        .eq('id', poId)
        .eq('user_id', userId)
        .eq('status', 'DRAFT');
      if (error) throw new Error(error.message);

      await writeAuditLog({
        userId,
        action: 'UPDATE',
        entityType: 'purchase_order',
        entityId: poId,
        oldValues: { status: 'DRAFT' },
        newValues: { status: 'SENT' },
      });
    },
    onSuccess: () => {
      toast.success('PO marked as Sent — ready to receive');
      void queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      void queryClient.invalidateQueries({ queryKey: ['receive-pos'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to mark PO as sent'),
  });

  const toggleExpand = useCallback(
    (id: string) => setExpandedPO((prev) => (prev === id ? null : id)),
    [],
  );

  /* ───────────────────── render ───────────────────── */

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Purchase Orders"
        description="Manage vendor purchase orders and receive stock."
        actions={<Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" />Create PO</Button>}
      />

      {/* PO Table */}
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        {posQuery.isLoading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded bg-muted"
              />
            ))}
          </div>
        ) : purchaseOrders.length === 0 ? (
          <EmptyState
            title="No purchase orders yet"
            description="Create your first PO to get started."
            action={<Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" />Create first PO</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-border bg-muted text-xs font-medium uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">PO #</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Expected</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrders.map((po) => (
                  <tr
                    key={po.id}
                    className="border-b border-border/70 last:border-0"
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleExpand(po.id)}
                        className="font-medium text-primary hover:underline"
                      >
                        {po.po_number}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {po.vendors?.company_name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={po.status ?? 'DRAFT'} />
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {po.expected_date
                        ? new Date(po.expected_date).toLocaleDateString('en-IN')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-foreground">
                      <CurrencyDisplay value={po.total_amount ?? 0} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {po.created_at
                        ? new Date(po.created_at).toLocaleDateString('en-IN')
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => toggleExpand(po.id)}
                          className="text-muted-foreground hover:text-foreground"
                          title="View lines"
                        ><ClipboardList className="h-4 w-4" /></button>
                        {po.status === 'DRAFT' && (
                          <button
                            type="button"
                            onClick={() => markSentMutation.mutate(po.id)}
                            className="text-xs font-medium text-blue-600 hover:underline"
                            title="Mark as Sent"
                            disabled={markSentMutation.isPending}
                          >
                            Send
                          </button>
                        )}
                        {(po.status === 'SENT' ||
                          po.status === 'PARTIALLY_RECEIVED') && (
                            <button
                              type="button"
                              onClick={() => setReceivingPO(po.id)}
                              className="text-emerald-600 hover:underline"
                              title="Receive stock"
                            ><PackageCheck className="h-4 w-4" /></button>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {poTotalPages > 1 ? (
          <div className="border-t border-border px-4 py-3">
            <Pagination page={poPage} totalPages={poTotalPages} onChange={setPoPage} />
          </div>
        ) : null}
      </div>

      {/* Expanded PO lines drawer */}
      {expandedPO && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/30"
          role="presentation"
          onClick={() => setExpandedPO(null)}
        >
          <div
            className="h-full w-full max-w-lg overflow-y-auto bg-card p-6 shadow-xl"
            role="dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                PO Line Items
              </h2>
              <button
                type="button"
                onClick={() => setExpandedPO(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            {linesQuery.isLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-16 animate-pulse rounded bg-muted"
                  />
                ))}
              </div>
            ) : poLines.length === 0 ? (
              <p className="text-sm text-muted-foreground">No line items.</p>
            ) : (
              <div className="space-y-3">
                {poLines.map((line) => {
                  const lineTotal = line.ordered_qty * line.unit_price;
                  const fullyReceived =
                    Number(line.received_qty ?? 0) >= Number(line.ordered_qty);
                  return (
                    <div
                      key={line.id}
                      className="rounded-md border border-border p-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-foreground">
                            {line.items?.standardized_name ?? 'Unknown item'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {line.items?.product_code}
                          </p>
                        </div>
                        <p className="font-medium text-foreground">
                          {formatCurrency(lineTotal)}
                        </p>
                      </div>
                      <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                        <span>Ordered: {line.ordered_qty}</span>
                        <span>Received: {line.received_qty}</span>
                        <span>Price: {formatCurrency(line.unit_price)}</span>
                      </div>
                      {fullyReceived && (
                        <span className="mt-1 inline-block text-xs font-medium text-emerald-600">
                          ✓ Fully received
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Receive stock confirmation */}
      {receivingPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-card p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-foreground">
              Receive stock
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Uses process_stock_movement — inventory and ledger update together.
            </p>

            <label className="mt-4 block text-xs font-medium text-muted-foreground">
              Receive into location
              <select
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={receiveLocationId || locations[0]?.id || ''}
                onChange={(e) => setReceiveLocationId(e.target.value)}
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.code})
                  </option>
                ))}
              </select>
            </label>

            <ReceiveLinesEditor
              poId={receivingPO}
              userId={userId}
              receiveQtys={receiveQtys}
              onQtyChange={(lineId, qty) =>
                setReceiveQtys((prev) => ({ ...prev, [lineId]: qty }))
              }
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setReceivingPO(null);
                  setReceiveQtys({});
                }}
                className="rounded-md border border-border px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  receiveStockMutation.isPending || locations.length === 0
                }
                onClick={() => receiveStockMutation.mutate(receivingPO)}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                {receiveStockMutation.isPending
                  ? 'Receiving…'
                  : 'Confirm receive'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create PO modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-12">
          <div
            className="w-full max-w-2xl rounded-lg bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                Create Purchase Order
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  form.reset();
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={form.handleSubmit((v) => createPOMutation.mutate(v))}
              className="space-y-5"
            >
              <label className="block text-sm font-medium text-foreground">
                Vendor
                <select
                  {...form.register('vendor_id')}
                  className="mt-1 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm"
                >
                  <option value="">Select vendor…</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.company_name}
                    </option>
                  ))}
                </select>
                {form.formState.errors.vendor_id && (
                  <p className="mt-1 text-xs text-red-600">
                    {form.formState.errors.vendor_id.message}
                  </p>
                )}
              </label>

              <label className="block text-sm font-medium text-foreground">
                Expected delivery date (optional)
                <input
                  type="date"
                  {...form.register('expected_date')}
                  className="mt-1 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm"
                />
              </label>

              <label className="block text-sm font-medium text-foreground">
                Notes (optional)
                <textarea
                  {...form.register('notes')}
                  rows={2}
                  className="mt-1 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm"
                />
              </label>

              {/* Line items */}
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">
                    Line items
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      append({ item_id: '', ordered_qty: 1, unit_price: 0 })
                    }
                    className="text-sm text-primary"
                  >
                    + Add line
                  </button>
                </div>
                {form.formState.errors.lines?.root && (
                  <p className="mt-1 text-xs text-red-600">
                    {form.formState.errors.lines.root.message}
                  </p>
                )}

                <div className="mt-3 space-y-3">
                  {fields.map((f, i) => (
                    <div
                      key={f.id}
                      className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-muted p-3"
                    >
                      <label className="flex-[2] text-xs font-medium text-foreground">
                        Item
                        <select
                          {...form.register(`lines.${i}.item_id`)}
                          className="mt-1 w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm"
                        >
                          <option value="">Select…</option>
                          {items.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.standardized_name} ({item.product_code})
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="w-24 text-xs font-medium text-foreground">
                        Qty
                        <input
                          type="number"
                          step="any"
                          min={1}
                          {...form.register(`lines.${i}.ordered_qty`)}
                          className="mt-1 w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm"
                        />
                      </label>
                      <label className="w-28 text-xs font-medium text-foreground">
                        Unit price (₹)
                        <input
                          type="number"
                          step="any"
                          min={0}
                          {...form.register(`lines.${i}.unit_price`)}
                          className="mt-1 w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => remove(i)}
                        className="mb-1 text-red-600"
                        title="Remove line"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border pt-4">
                <p className="text-sm font-medium text-foreground">
                  Total: {formatCurrency(formTotal)}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreate(false);
                      form.reset();
                    }}
                    className="rounded-md border border-border px-4 py-2 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createPOMutation.isPending}
                    className="rounded-md bg-primary px-4 py-2 text-sm text-white disabled:opacity-50"
                  >
                    {createPOMutation.isPending ? 'Creating…' : 'Create PO'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ReceiveLinesEditor({
  poId,
  userId,
  receiveQtys,
  onQtyChange,
}: {
  poId: string;
  userId: string | null;
  receiveQtys: Record<string, number>;
  onQtyChange: (lineId: string, qty: number) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { data: lines = [], isLoading } = useRealtimeQuery<POLineWithItem[]>(
    ['po_receive_lines', poId],
    'purchase_order_lines',
    async () => {
      const { data, error } = await supabase
        .from('purchase_order_lines')
        .select(
          '*, items(standardized_name, product_code, unit)',
        )
        .eq('purchase_order_id', poId)
        .eq('user_id', userId!);
      if (error) throw error;
      return (data ?? []) as unknown as POLineWithItem[];
    },
    !!userId,
  );

  if (isLoading) {
    return <div className="mt-4 h-24 animate-pulse rounded bg-muted" />;
  }

  return (
    <div className="mt-4 space-y-3">
      {lines.map((line) => {
        const remaining =
          Number(line.ordered_qty) - Number(line.received_qty);
        if (remaining <= 0) {
          return (
            <div
              key={line.id}
              className="rounded-md border border-border p-3 text-sm text-muted-foreground"
            >
              {line.items?.standardized_name} — fully received
            </div>
          );
        }
        const value =
          receiveQtys[line.id] !== undefined ? receiveQtys[line.id] : remaining;
        return (
          <div key={line.id} className="rounded-md border border-border p-3">
            <p className="font-medium text-foreground">
              {line.items?.standardized_name}
              <span className="ml-2 font-mono text-xs text-muted-foreground">
                {line.items?.product_code}
              </span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ordered {line.ordered_qty} · Received {line.received_qty} ·
              Remaining {remaining}
            </p>
            <label className="mt-2 block text-xs font-medium">
              Receiving now
              <input
                type="number"
                min={0}
                max={remaining}
                step="0.01"
                className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                value={value}
                onChange={(e) =>
                  onQtyChange(line.id, Number(e.target.value) || 0)
                }
              />
            </label>
          </div>
        );
      })}
    </div>
  );
}
