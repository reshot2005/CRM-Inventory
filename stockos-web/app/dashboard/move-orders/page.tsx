'use client';

import { useCallback, useMemo, useState } from 'react';
import { useForm, useFieldArray, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Eye, Plus, X } from 'lucide-react';
import { EmptyState, PageHeader, StatusBadge } from '@/components/ui/enterprise';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { useUserId } from '@/lib/hooks/useUserId';
import { useRealtimeQuery } from '@/lib/hooks/useRealtimeQuery';
import { LOOKUP_KEYS } from '@/lib/query/lookups';
import {
  generateOrderNumber,
  processStockMovement,
} from '@/lib/stock/movements';
import { writeAuditLog } from '@/lib/audit/write-audit-log';

// ── Types ────────────────────────────────────────────────────

type MoveOrderStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'APPROVED'
  | 'IN_TRANSIT'
  | 'COMPLETED'
  | 'CANCELLED';

interface LocationOption {
  id: string;
  name: string;
  code: string;
}

interface ItemOption {
  id: string;
  standardized_name: string;
  product_code: string;
}

interface MoveOrderLineRow {
  id: string;
  item_id: string;
  requested_qty: number;
  dispatched_qty: number | null;
  received_qty: number | null;
}

interface MoveOrderRow {
  id: string;
  user_id: string;
  order_number: string;
  type: string;
  status: MoveOrderStatus;
  from_location_id: string | null;
  to_location_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  from_location: LocationOption | null;
  to_location: LocationOption | null;
  move_order_lines: MoveOrderLineRow[];
}

// ── Zod Schema ───────────────────────────────────────────────

const lineSchema = z.object({
  item_id: z.string().min(1, 'Select an item'),
  quantity: z.number().int().min(1, 'Min 1'),
});

const transferSchema = z
  .object({
    from_location_id: z.string().min(1, 'Select source location'),
    to_location_id: z.string().min(1, 'Select destination location'),
    notes: z.string().max(500),
    lines: z.array(lineSchema).min(1, 'Add at least one item'),
  })
  .refine((d) => d.from_location_id !== d.to_location_id, {
    message: 'Source and destination must be different',
    path: ['to_location_id'],
  });

type TransferFormValues = {
  from_location_id: string;
  to_location_id: string;
  notes: string;
  lines: Array<{ item_id: string; quantity: number }>;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function invalidateTransferQueries(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  void queryClient.invalidateQueries({ queryKey: ['move_orders'] });
  void queryClient.invalidateQueries({ queryKey: ['items'] });
  void queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
  void queryClient.invalidateQueries({ queryKey: ['low-stock'] });
  void queryClient.invalidateQueries({ queryKey: ['dashboard-ledger'] });
}

// ── Page Component ───────────────────────────────────────────

export default function MoveOrdersPage() {
  const userId = useUserId();
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState<MoveOrderRow | null>(null);
  const [confirmCompleteId, setConfirmCompleteId] = useState<string | null>(null);

  // ── Fetch active locations ────────────────────────────────

  const { data: locationOptions = [] } = useQuery({
    queryKey: [...LOOKUP_KEYS.locations],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name, code')
        .eq('user_id', userId!)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return (data ?? []) as LocationOption[];
    },
    enabled: !!userId && modalOpen,
  });

  // ── Fetch active items ────────────────────────────────────

  const { data: itemOptions = [] } = useQuery({
    queryKey: [...LOOKUP_KEYS.items],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('items')
        .select('id, standardized_name, product_code')
        .eq('user_id', userId!)
        .eq('is_active', true)
        .order('standardized_name');

      if (error) throw error;
      return (data ?? []) as ItemOption[];
    },
    enabled: !!userId && modalOpen,
  });

  // ── Fetch move orders with location names & line count ────

  const fetchOrders = useCallback(async (): Promise<MoveOrderRow[]> => {
    const { data, error } = await supabase
      .from('move_orders')
      .select(
        `*,
         from_location:locations!move_orders_from_location_id_fkey(id, name, code),
         to_location:locations!move_orders_to_location_id_fkey(id, name, code),
         move_order_lines(id, item_id, requested_qty, dispatched_qty, received_qty)`,
      )
      .eq('user_id', userId!)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as unknown as MoveOrderRow[];
  }, [supabase, userId]);

  const { data: orders = [], isLoading } = useRealtimeQuery<MoveOrderRow[]>(
    ['move_orders', userId ?? ''],
    'move_orders',
    fetchOrders,
    !!userId,
  );

  // ── Create transfer mutation ──────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (values: TransferFormValues) => {
      if (!userId) throw new Error('Not authenticated');

      const orderNumber = await generateOrderNumber(userId, 'MO');

      const { data: order, error: orderErr } = await supabase
        .from('move_orders')
        .insert({
          user_id: userId,
          order_number: orderNumber,
          type: 'TRANSFER',
          status: 'PENDING',
          from_location_id: values.from_location_id,
          to_location_id: values.to_location_id,
          notes: values.notes || null,
        })
        .select('id')
        .single();

      if (orderErr) throw orderErr;

      const lines = values.lines.map((line) => ({
        user_id: userId,
        move_order_id: order.id,
        item_id: line.item_id,
        requested_qty: line.quantity,
      }));

      const { error: linesErr } = await supabase
        .from('move_order_lines')
        .insert(lines);

      if (linesErr) throw linesErr;

      await writeAuditLog({
        userId,
        action: 'CREATE',
        entityType: 'move_order',
        entityId: order.id,
        newValues: {
          order_number: orderNumber,
          from_location_id: values.from_location_id,
          to_location_id: values.to_location_id,
          status: 'PENDING',
          line_count: values.lines.length,
        },
      });
    },
    onSuccess: () => {
      toast.success('Transfer order created');
      void queryClient.invalidateQueries({ queryKey: ['move_orders'] });
      setModalOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Complete transfer mutation ────────────────────────────

  const completeMutation = useMutation({
    mutationFn: async (orderId: string) => {
      if (!userId) throw new Error('Not authenticated');

      const order = orders.find((o) => o.id === orderId);
      if (!order) throw new Error('Order not found');
      if (!order.from_location_id || !order.to_location_id)
        throw new Error('Missing location IDs');

      const fromLocId = order.from_location_id;
      const toLocId = order.to_location_id;

      for (const line of order.move_order_lines) {
        const qty = line.requested_qty;
        const transferNotes = {
          out: `Transfer to ${order.to_location?.name ?? toLocId}`,
          in: `Transfer from ${order.from_location?.name ?? fromLocId}`,
        };

        await processStockMovement({
          userId,
          locationId: fromLocId,
          itemId: line.item_id,
          movementType: 'TRANSFER_OUT',
          quantity: qty,
          referenceType: 'MOVE_ORDER',
          referenceId: orderId,
          notes: transferNotes.out,
          createdBy: userId,
        });

        try {
          await processStockMovement({
            userId,
            locationId: toLocId,
            itemId: line.item_id,
            movementType: 'TRANSFER_IN',
            quantity: qty,
            referenceType: 'MOVE_ORDER',
            referenceId: orderId,
            notes: transferNotes.in,
            createdBy: userId,
          });
        } catch (inErr) {
          throw new Error(
            `${inErr instanceof Error ? inErr.message : 'Transfer-in failed'} — stock was deducted at source; verify destination inventory manually.`,
          );
        }

        const { error: lineUpdateErr } = await supabase
          .from('move_order_lines')
          .update({
            dispatched_qty: qty,
            received_qty: qty,
          })
          .eq('id', line.id);

        if (lineUpdateErr) throw lineUpdateErr;
      }

      const { error: statusErr } = await supabase
        .from('move_orders')
        .update({ status: 'COMPLETED' })
        .eq('id', orderId);

      if (statusErr) throw statusErr;

      await writeAuditLog({
        userId,
        action: 'UPDATE',
        entityType: 'move_order',
        entityId: orderId,
        oldValues: { status: order.status },
        newValues: { status: 'COMPLETED' },
      });
    },
    onSuccess: () => {
      toast.success('Transfer completed — inventory updated');
      invalidateTransferQueries(queryClient);
      setConfirmCompleteId(null);
      setDetailOrder(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Cancel mutation ───────────────────────────────────────

  const cancelMutation = useMutation({
    mutationFn: async (orderId: string) => {
      if (!userId) throw new Error('Not authenticated');
      const order = orders.find((o) => o.id === orderId);
      const { error } = await supabase
        .from('move_orders')
        .update({ status: 'CANCELLED' })
        .eq('id', orderId);

      if (error) throw error;

      await writeAuditLog({
        userId,
        action: 'REJECT',
        entityType: 'move_order',
        entityId: orderId,
        oldValues: { status: order?.status },
        newValues: { status: 'CANCELLED' },
      });
    },
    onSuccess: () => {
      toast.success('Transfer cancelled');
      void queryClient.invalidateQueries({ queryKey: ['move_orders'] });
      setDetailOrder(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Render ────────────────────────────────────────────────

  const itemMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of itemOptions) {
      m.set(i.id, `${i.standardized_name} (${i.product_code})`);
    }
    return m;
  }, [itemOptions]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Move Orders"
        description="Transfer stock between locations."
        actions={<Button onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" />New Transfer</Button>}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {(
          [
            ['PENDING', 'Pending'],
            ['IN_TRANSIT', 'In Transit'],
            ['COMPLETED', 'Completed'],
            ['CANCELLED', 'Cancelled'],
          ] as const
        ).map(([status, label]) => {
          const count = orders.filter((o) => o.status === status).length;
          return (
            <div
              key={status}
              className="rounded-lg border border-border bg-card p-4 shadow-sm"
            >
              <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{count}</p>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="h-14 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            title="No move orders yet"
            description="Create your first stock transfer between locations."
            action={<Button onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" />Create first transfer</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-border bg-muted text-xs font-medium uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Order #</th>
                  <th className="px-4 py-3">From</th>
                  <th className="px-4 py-3">To</th>
                  <th className="px-4 py-3">Lines</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-border/70 last:border-0"
                  >
                    <td className="px-4 py-3 font-mono text-xs font-medium text-foreground">
                      {order.order_number}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {order.from_location?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {order.to_location?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-foreground">
                      {order.move_order_lines.length}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setDetailOrder(order)}
                          className="text-primary hover:underline"
                          title="View details"
                        ><Eye className="h-4 w-4" /></button>
                        {(order.status === 'PENDING' || order.status === 'APPROVED' || order.status === 'IN_TRANSIT') && (
                          <button
                            type="button"
                            onClick={() => setConfirmCompleteId(order.id)}
                            className="text-emerald-600 hover:underline"
                            title="Complete transfer"
                          ><Check className="h-4 w-4" /></button>
                        )}
                        {order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
                          <button
                            type="button"
                            onClick={() => cancelMutation.mutate(order.id)}
                            className="text-red-600 hover:underline"
                            title="Cancel"
                          ><X className="h-4 w-4" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Transfer Modal */}
      {modalOpen && (
        <TransferFormModal
          locations={locationOptions}
          items={itemOptions}
          onClose={() => setModalOpen(false)}
          onSubmit={(v) => createMutation.mutate(v)}
          isSubmitting={createMutation.isPending}
        />
      )}

      {/* Detail Drawer */}
      {detailOrder && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/30"
          role="presentation"
          onClick={() => setDetailOrder(null)}
        >
          <div
            className="h-full w-full max-w-md overflow-y-auto bg-card p-6 shadow-xl"
            role="dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                {detailOrder.order_number}
              </h2>
              <button
                type="button"
                onClick={() => setDetailOrder(null)}
                className="text-muted-foreground"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <StatusBadge status={detailOrder.status} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">From</span>
                <span className="text-foreground">
                  {detailOrder.from_location?.name ?? '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">To</span>
                <span className="text-foreground">
                  {detailOrder.to_location?.name ?? '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="text-foreground">
                  {formatDate(detailOrder.created_at)}
                </span>
              </div>
              {detailOrder.notes && (
                <div>
                  <p className="text-muted-foreground">Notes</p>
                  <p className="mt-0.5 text-foreground">{detailOrder.notes}</p>
                </div>
              )}

              <div className="border-t border-border pt-3">
                <p className="mb-2 text-sm font-medium text-muted-foreground">
                  Line items ({detailOrder.move_order_lines.length})
                </p>
                <ul className="space-y-2">
                  {detailOrder.move_order_lines.map((line) => (
                    <li
                      key={line.id}
                      className="rounded-md border border-border p-3"
                    >
                      <p className="font-medium text-foreground">
                        {itemMap.get(line.item_id) ?? line.item_id}
                      </p>
                      <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
                        <span>Requested: {line.requested_qty}</span>
                        <span>Dispatched: {line.dispatched_qty ?? 0}</span>
                        <span>Received: {line.received_qty ?? 0}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {(detailOrder.status === 'PENDING' ||
                detailOrder.status === 'APPROVED' ||
                detailOrder.status === 'IN_TRANSIT') && (
                <div className="flex gap-2 border-t border-border pt-4">
                  <button
                    type="button"
                    disabled={completeMutation.isPending}
                    onClick={() => setConfirmCompleteId(detailOrder.id)}
                    className="flex-1 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {completeMutation.isPending ? 'Processing…' : 'Complete Transfer'}
                  </button>
                  <button
                    type="button"
                    disabled={cancelMutation.isPending}
                    onClick={() => cancelMutation.mutate(detailOrder.id)}
                    className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm complete dialog */}
      {confirmCompleteId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="max-w-sm rounded-lg bg-card p-6 shadow-xl">
            <p className="font-medium text-foreground">Complete this transfer?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This will deduct stock from the source location, add to destination, and
              write ledger entries. This action cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmCompleteId(null)}
                className="rounded-md border border-border px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={completeMutation.isPending}
                onClick={() => completeMutation.mutate(confirmCompleteId)}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                {completeMutation.isPending ? 'Processing…' : 'Confirm & Complete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Transfer Form Modal ─────────────────────────────────────

function TransferFormModal({
  locations,
  items,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  locations: LocationOption[];
  items: ItemOption[];
  onClose: () => void;
  onSubmit: (values: TransferFormValues) => void;
  isSubmitting: boolean;
}) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchema) as Resolver<TransferFormValues>,
    defaultValues: {
      from_location_id: '',
      to_location_id: '',
      notes: '',
      lines: [{ item_id: '', quantity: 1 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'lines',
  });

  const fromLocationId = watch('from_location_id');

  const availableDestinations = useMemo(
    () => locations.filter((l) => l.id !== fromLocationId),
    [locations, fromLocationId],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-card shadow-xl"
        role="dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">New Stock Transfer</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-6 py-5">
          {/* Locations */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                From Location *
              </label>
              <select
                {...register('from_location_id')}
                className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Select source…</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.code})
                  </option>
                ))}
              </select>
              {errors.from_location_id && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.from_location_id.message}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                To Location *
              </label>
              <select
                {...register('to_location_id')}
                className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Select destination…</option>
                {availableDestinations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.code})
                  </option>
                ))}
              </select>
              {errors.to_location_id && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.to_location_id.message}
                </p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Notes
            </label>
            <textarea
              {...register('notes')}
              rows={2}
              placeholder="Optional transfer notes…"
              className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {/* Line items */}
          <div className="border-t border-border pt-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">
                Items to transfer *
              </p>
              <button
                type="button"
                onClick={() => append({ item_id: '', quantity: 1 })}
                className="rounded bg-muted px-2 py-1 text-xs font-medium text-primary hover:bg-muted"
              >
                + Add Line
              </button>
            </div>

            {errors.lines?.root && (
              <p className="mb-2 text-xs text-red-600">{errors.lines.root.message}</p>
            )}

            <div className="space-y-2">
              {fields.map((field, idx) => (
                <div key={field.id} className="flex items-start gap-2">
                  <div className="flex-1">
                    <select
                      {...register(`lines.${idx}.item_id`)}
                      className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">Select item…</option>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.standardized_name} ({item.product_code})
                        </option>
                      ))}
                    </select>
                    {errors.lines?.[idx]?.item_id && (
                      <p className="mt-0.5 text-xs text-red-600">
                        {errors.lines[idx]?.item_id?.message}
                      </p>
                    )}
                  </div>
                  <div className="w-24">
                    <input
                      type="number"
                      min={1}
                      {...register(`lines.${idx}.quantity`)}
                      placeholder="Qty"
                      className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    {errors.lines?.[idx]?.quantity && (
                      <p className="mt-0.5 text-xs text-red-600">
                        {errors.lines[idx]?.quantity?.message}
                      </p>
                    )}
                  </div>
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      className="mt-2 text-red-500 hover:text-red-700"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
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
              {isSubmitting ? 'Creating…' : 'Create Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
