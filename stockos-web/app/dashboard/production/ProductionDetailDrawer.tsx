'use client';

import { useMemo, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, PlayCircle, Plus, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CurrencyDisplay, StatusBadge } from '@/components/ui/enterprise';
import { DataTableSkeleton } from '@/components/ui/DataTableSkeleton';
import { createClient, type Tables } from '@/lib/supabase/client';
import { useRealtimeQuery } from '@/lib/hooks/useRealtimeQuery';
import { processStockMovement } from '@/lib/stock/movements';
import { insertNotification } from '@/lib/stock/manufacturing';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils/format';
import { QUALITY_STATUSES, type MaterialLineWithItem, type ProductionOrderRow } from './types';
import { writeAuditLog } from '@/lib/audit/write-audit-log';

/* ───────────────────── inventory pre-check ───────────────────── */

interface ShortLine {
  materialId: string;
  name: string;
  required: number;
  available: number;
  unit: string;
}

async function findShortages(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  locationId: string,
  lines: MaterialLineWithItem[],
): Promise<ShortLine[]> {
  if (lines.length === 0) return [];
  const materialIds = lines.map((l) => l.raw_material_id);
  const { data: inventoryRows, error } = await supabase
    .from('inventory')
    .select('item_id, quantity')
    .eq('user_id', userId)
    .eq('location_id', locationId)
    .in('item_id', materialIds);
  if (error) throw new Error(error.message);

  const shortages: ShortLine[] = [];
  for (const line of lines) {
    const available = (inventoryRows ?? [])
      .filter((r) => r.item_id === line.raw_material_id)
      .reduce((sum, r) => sum + Number(r.quantity), 0);
    if (available < Number(line.required_qty)) {
      shortages.push({
        materialId: line.raw_material_id,
        name: line.items?.standardized_name ?? 'Unknown material',
        required: Number(line.required_qty),
        available,
        unit: line.items?.unit ?? '',
      });
    }
  }
  return shortages;
}

/* ───────────────────── complete form ───────────────────── */

const completeSchema = z.object({
  actual_qty: z.number().min(0.0001, 'Actual quantity must be > 0'),
  batch_number: z.string().min(1, 'Batch number required'),
  quality_status: z.enum(QUALITY_STATUSES),
  expiry_date: z.string(),
});

type CompleteFormValues = z.infer<typeof completeSchema>;

const labourSchema = z.object({
  worker_name: z.string().min(1, 'Worker name required'),
  hours: z.number().min(0.01, 'Hours must be > 0'),
  rate: z.number().min(0, 'Rate must be ≥ 0'),
  notes: z.string(),
});

type LabourFormValues = z.infer<typeof labourSchema>;

/* ───────────────────── component ───────────────────── */

export function ProductionDetailDrawer({
  order,
  onOpenChange,
  userId,
}: {
  order: ProductionOrderRow | null;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
}) {
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showLabourForm, setShowLabourForm] = useState(false);
  const [pendingComplete, setPendingComplete] = useState<CompleteFormValues | null>(null);

  const linesQuery = useRealtimeQuery<MaterialLineWithItem[]>(
    ['production-material-lines', order?.id ?? ''],
    'production_material_lines',
    async () => {
      if (!order) return [];
      const { data, error } = await supabase
        .from('production_material_lines')
        .select('*, items!production_material_lines_raw_material_id_fkey(id, standardized_name, product_code, unit)')
        .eq('production_order_id', order.id);
      if (error) throw error;
      return (data ?? []) as unknown as MaterialLineWithItem[];
    },
    !!order,
  );

  const materialLines = linesQuery.data ?? [];

  const labourQuery = useRealtimeQuery<Tables<'labour_entries'>[]>(
    ['labour_entries', order?.id ?? ''],
    'labour_entries',
    async () => {
      if (!order) return [];
      const { data, error } = await supabase
        .from('labour_entries')
        .select('*')
        .eq('production_order_id', order.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    !!order,
  );

  const labourEntries = labourQuery.data ?? [];
  const totalLabourCost = labourEntries.reduce(
    (sum, entry) => sum + Number(entry.hours) * Number(entry.rate ?? 0),
    0,
  );

  const batchesQuery = useRealtimeQuery<Tables<'batches'>[]>(
    ['production-batches', order?.id ?? ''],
    'batches',
    async () => {
      if (!order) return [];
      const { data, error } = await supabase
        .from('batches')
        .select('*')
        .eq('production_order_id', order.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    !!order,
  );

  const batches = batchesQuery.data ?? [];

  const completeForm = useForm<CompleteFormValues>({
    resolver: zodResolver(completeSchema) as Resolver<CompleteFormValues>,
    defaultValues: {
      actual_qty: order?.target_qty ?? 1,
      batch_number: order ? `${order.order_number}-B1` : '',
      quality_status: 'PASSED',
      expiry_date: '',
    },
  });

  const labourForm = useForm<LabourFormValues>({
    resolver: zodResolver(labourSchema) as Resolver<LabourFormValues>,
    defaultValues: { worker_name: '', hours: 1, rate: 0, notes: '' },
  });

  function invalidateStockQueries() {
    void queryClient.invalidateQueries({ queryKey: ['production_orders'] });
    void queryClient.invalidateQueries({ queryKey: ['production-material-lines'] });
    void queryClient.invalidateQueries({ queryKey: ['inventory'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
    void queryClient.invalidateQueries({ queryKey: ['low-stock'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard-ledger'] });
    void queryClient.invalidateQueries({ queryKey: ['machines'] });
    void queryClient.invalidateQueries({ queryKey: ['production-machines-lookup'] });
    void queryClient.invalidateQueries({ queryKey: ['items'] });
  }

  /* ── Start production: pre-check every line before consuming anything ── */
  const startMutation = useMutation({
    mutationFn: async () => {
      if (!userId || !order) throw new Error('Not authenticated');
      if (!order.location_id) throw new Error('Order has no production location set');

      const { data: lines, error: linesErr } = await supabase
        .from('production_material_lines')
        .select('*, items!production_material_lines_raw_material_id_fkey(id, standardized_name, product_code, unit)')
        .eq('production_order_id', order.id);
      if (linesErr) throw new Error(linesErr.message);
      const materialRows = (lines ?? []) as unknown as MaterialLineWithItem[];
      if (materialRows.length === 0) throw new Error('No material lines on this order');

      // Blocking pre-check: abort with no side effects if ANY material is short,
      // so we never consume some raw materials and leave the order half-started.
      const shortages = await findShortages(supabase, userId, order.location_id, materialRows);
      if (shortages.length > 0) {
        throw new Error(
          `Insufficient stock — ${shortages
            .map((s) => `${s.name} (need ${s.required}, have ${s.available})`)
            .join('; ')}`,
        );
      }

      for (const line of materialRows) {
        await processStockMovement({
          userId,
          locationId: order.location_id,
          itemId: line.raw_material_id,
          movementType: 'PRODUCTION_OUT',
          quantity: Number(line.required_qty),
          referenceType: 'PRODUCTION_ORDER',
          referenceId: order.id,
          notes: `Consumed for ${order.order_number}`,
          createdBy: userId,
        });

        const { error: updErr } = await supabase
          .from('production_material_lines')
          .update({ consumed_qty: line.required_qty })
          .eq('id', line.id);
        if (updErr) throw new Error(updErr.message);
      }

      const { error: orderErr } = await supabase
        .from('production_orders')
        .update({ status: 'IN_PROGRESS', started_at: new Date().toISOString() })
        .eq('id', order.id)
        .eq('user_id', userId);
      if (orderErr) throw new Error(orderErr.message);

      if (order.machine_id) {
        await supabase.from('machines').update({ status: 'RUNNING' }).eq('id', order.machine_id);
      }

      await writeAuditLog({
        userId,
        action: 'UPDATE',
        entityType: 'production_order',
        entityId: order.id,
        oldValues: { status: 'PLANNED' },
        newValues: { status: 'IN_PROGRESS', materials_consumed: materialRows.length },
      });
    },
    onSuccess: () => {
      toast.success(`${order?.order_number} started — raw materials consumed`);
      invalidateStockQueries();
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to start production'),
  });

  /* ── Complete production ── */
  const completeMutation = useMutation({
    mutationFn: async (values: CompleteFormValues) => {
      if (!userId || !order) throw new Error('Not authenticated');
      if (!order.location_id) throw new Error('Order has no production location set');
      const finishedGoodId = order.boms?.finished_good_id;
      if (!finishedGoodId) throw new Error('BOM has no finished good linked');

      const { data: batch, error: batchErr } = await supabase.from('batches').insert({
        user_id: userId,
        production_order_id: order.id,
        batch_number: values.batch_number.trim(),
        quantity: values.actual_qty,
        quality_status: values.quality_status,
        expiry_date: values.expiry_date || null,
      }).select('id').single();
      if (batchErr) throw new Error(batchErr.message);

      await processStockMovement({
        userId,
        locationId: order.location_id,
        itemId: finishedGoodId,
        movementType: 'PRODUCTION_IN',
        quantity: values.actual_qty,
        referenceType: 'PRODUCTION_ORDER',
        referenceId: order.id,
        notes: `Produced via ${order.order_number}`,
        createdBy: userId,
      });

      const yieldPercent = (values.actual_qty / Number(order.target_qty)) * 100;

      for (const line of materialLines) {
        const variance = Number(line.required_qty) - Number(line.consumed_qty ?? 0);
        const { error: varErr } = await supabase
          .from('production_material_lines')
          .update({ variance })
          .eq('id', line.id);
        if (varErr) throw new Error(varErr.message);
      }

      const { error: orderErr } = await supabase
        .from('production_orders')
        .update({
          status: 'COMPLETED',
          actual_qty: values.actual_qty,
          batch_number: values.batch_number.trim(),
          yield_percent: yieldPercent,
          completed_at: new Date().toISOString(),
        })
        .eq('id', order.id)
        .eq('user_id', userId);
      if (orderErr) throw new Error(orderErr.message);

      await insertNotification({
        userId,
        type: 'PRODUCTION_COMPLETE',
        title: `Production ${order.order_number} completed`,
        body: `Produced ${values.actual_qty} ${order.boms?.items?.unit ?? ''} · Yield ${yieldPercent.toFixed(1)}%`,
        link: `/dashboard/production?order=${order.id}`,
      });

      if (order.machine_id) {
        await supabase.from('machines').update({ status: 'IDLE' }).eq('id', order.machine_id);
      }

      await writeAuditLog({
        userId,
        action: 'UPDATE',
        entityType: 'production_order',
        entityId: order.id,
        oldValues: { status: 'IN_PROGRESS' },
        newValues: {
          status: 'COMPLETED',
          actual_qty: values.actual_qty,
          yield_percent: yieldPercent,
          batch_number: values.batch_number.trim(),
        },
      });

      await writeAuditLog({
        userId,
        action: 'CREATE',
        entityType: 'batch',
        entityId: batch.id,
        newValues: {
          batch_number: values.batch_number.trim(),
          quantity: values.actual_qty,
          quality_status: values.quality_status,
          production_order_id: order.id,
        },
      });

      return yieldPercent;
    },
    onSuccess: (yieldPercent) => {
      toast.success(`${order?.order_number} completed — yield ${yieldPercent.toFixed(1)}%`);
      invalidateStockQueries();
      void queryClient.invalidateQueries({ queryKey: ['production-batches'] });
      setShowCompleteDialog(false);
      setPendingComplete(null);
      completeForm.reset();
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to complete production'),
  });

  function onCompleteSubmit(values: CompleteFormValues) {
    const hasPartial = materialLines.some(
      (line) => Number(line.consumed_qty ?? 0) < Number(line.required_qty),
    );
    if (hasPartial) {
      setPendingComplete(values);
      return;
    }
    completeMutation.mutate(values);
  }

  const labourMutation = useMutation({
    mutationFn: async (values: LabourFormValues) => {
      if (!userId || !order) throw new Error('Not authenticated');
      const { data: entry, error } = await supabase.from('labour_entries').insert({
        user_id: userId,
        production_order_id: order.id,
        worker_name: values.worker_name.trim(),
        hours: values.hours,
        rate: values.rate,
        notes: values.notes.trim() || null,
      }).select('id').single();
      if (error) throw new Error(error.message);

      await writeAuditLog({
        userId,
        action: 'CREATE',
        entityType: 'labour_entry',
        entityId: entry.id,
        newValues: {
          production_order_id: order.id,
          worker_name: values.worker_name.trim(),
          hours: values.hours,
          rate: values.rate,
        },
      });
    },
    onSuccess: () => {
      toast.success('Labour entry logged');
      void queryClient.invalidateQueries({ queryKey: ['labour_entries'] });
      labourForm.reset({ worker_name: '', hours: 1, rate: 0, notes: '' });
      setShowLabourForm(false);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to log labour'),
  });

  if (!order) return null;

  const fgName = order.boms?.items?.standardized_name ?? 'Unknown finished good';
  const fgUnit = order.boms?.items?.unit ?? '';

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex justify-end bg-black/30"
        role="presentation"
        onClick={() => onOpenChange(false)}
      >
        <div
          className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-card p-6 shadow-xl"
          role="dialog"
          aria-label="Production order details"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-lg font-semibold text-foreground">{order.order_number}</p>
              <p className="text-sm text-muted-foreground">{fgName}</p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={order.status ?? 'PLANNED'} />
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">Target / Actual</p>
              <p className="font-medium text-foreground">
                {order.target_qty} {fgUnit}
                {order.actual_qty != null ? ` / ${order.actual_qty} ${fgUnit}` : ''}
              </p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">Yield</p>
              <p className="font-medium text-foreground">
                {order.yield_percent != null ? `${Number(order.yield_percent).toFixed(1)}%` : '—'}
              </p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">Location</p>
              <p className="font-medium text-foreground">{order.locations?.name ?? '—'}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">Machine</p>
              <p className="font-medium text-foreground">{order.machines?.name ?? 'Unassigned'}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">Deadline</p>
              <p className="font-medium text-foreground">{formatDate(order.deadline)}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">Started / Completed</p>
              <p className="font-medium text-foreground">
                {formatDateTime(order.started_at)}
                {order.completed_at ? ` → ${formatDateTime(order.completed_at)}` : ''}
              </p>
            </div>
          </div>

          {order.notes ? <p className="mb-4 text-sm text-muted-foreground">{order.notes}</p> : null}

          <div className="mb-4 flex flex-wrap gap-2">
            {order.status === 'PLANNED' ? (
              <Button
                size="sm"
                onClick={() => startMutation.mutate()}
                disabled={startMutation.isPending}
              >
                <PlayCircle className="h-4 w-4" />
                {startMutation.isPending ? 'Starting…' : 'Start production'}
              </Button>
            ) : null}
            {order.status === 'IN_PROGRESS' ? (
              <Button size="sm" onClick={() => setShowCompleteDialog(true)}>
                <CheckCircle2 className="h-4 w-4" />
                Complete production
              </Button>
            ) : null}
          </div>

          <h3 className="mb-2 text-sm font-semibold text-foreground">Material lines</h3>
          {linesQuery.isLoading ? (
            <DataTableSkeleton rows={3} cols={4} />
          ) : materialLines.length === 0 ? (
            <p className="text-sm text-muted-foreground">No material lines.</p>
          ) : (
            <div className="space-y-2">
              {materialLines.map((line) => (
                <div key={line.id} className="rounded-md border border-border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">
                      {line.items?.standardized_name ?? 'Unknown material'}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {line.items?.product_code}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      Required: {Number(line.required_qty).toFixed(4)} {line.items?.unit ?? ''}
                    </span>
                    <span>
                      Consumed: {Number(line.consumed_qty ?? 0).toFixed(4)} {line.items?.unit ?? ''}
                    </span>
                    {line.variance != null ? (
                      <span>
                        Variance: {Number(line.variance).toFixed(4)} {line.items?.unit ?? ''}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}

          {batches.length > 0 ? (
            <>
              <h3 className="mb-2 mt-6 text-sm font-semibold text-foreground">Batches</h3>
              <div className="space-y-2">
                {batches.map((batch) => (
                  <div key={batch.id} className="rounded-md border border-border p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-medium text-foreground">{batch.batch_number}</span>
                      <StatusBadge status={batch.quality_status ?? 'PENDING'} />
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Qty: {batch.quantity}</span>
                      {batch.expiry_date ? <span>Expires: {formatDate(batch.expiry_date)}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          <div className="mt-6 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Labour</h3>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                Total cost: <CurrencyDisplay value={totalLabourCost} className="font-medium text-foreground" />
              </span>
              <Button size="sm" variant="outline" onClick={() => setShowLabourForm((v) => !v)}>
                <Users className="h-4 w-4" />
                Log labour
              </Button>
            </div>
          </div>

          {showLabourForm ? (
            <form
              onSubmit={labourForm.handleSubmit((values) => labourMutation.mutate(values))}
              className="mt-3 space-y-2 rounded-md border border-border p-3"
            >
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Worker name
                  <input
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    {...labourForm.register('worker_name')}
                  />
                </label>
                <label className="text-xs font-medium text-muted-foreground">
                  Hours
                  <input
                    type="number"
                    step="0.25"
                    min="0.01"
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    {...labourForm.register('hours', { valueAsNumber: true })}
                  />
                </label>
                <label className="text-xs font-medium text-muted-foreground">
                  Rate per hour (₹)
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    {...labourForm.register('rate', { valueAsNumber: true })}
                  />
                </label>
                <label className="text-xs font-medium text-muted-foreground">
                  Notes (optional)
                  <input
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    {...labourForm.register('notes')}
                  />
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" size="sm" variant="outline" onClick={() => setShowLabourForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={labourMutation.isPending}>
                  <Plus className="h-4 w-4" />
                  {labourMutation.isPending ? 'Logging…' : 'Log entry'}
                </Button>
              </div>
            </form>
          ) : null}

          <div className="mt-3 space-y-2">
            {labourQuery.isLoading ? (
              <DataTableSkeleton rows={2} cols={3} />
            ) : labourEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No labour logged yet.</p>
            ) : (
              labourEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-md border border-border p-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-foreground">{entry.worker_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.hours}h × {formatCurrency(entry.rate)}
                      {entry.notes ? ` · ${entry.notes}` : ''}
                    </p>
                  </div>
                  <CurrencyDisplay value={Number(entry.hours) * Number(entry.rate ?? 0)} className="font-medium" />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Complete production dialog ── */}
      <Dialog
        open={showCompleteDialog}
        onOpenChange={(open) => {
          setShowCompleteDialog(open);
          if (!open) setPendingComplete(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Complete production</DialogTitle>
            <DialogDescription>
              Records the finished-goods batch and consumes it into stock via PRODUCTION_IN.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={completeForm.handleSubmit(onCompleteSubmit)} className="space-y-3">
            <label className="block text-xs font-medium text-muted-foreground">
              Actual quantity produced
              <input
                type="number"
                step="0.0001"
                min="0.0001"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                {...completeForm.register('actual_qty', { valueAsNumber: true })}
              />
              {completeForm.formState.errors.actual_qty ? (
                <span className="text-xs text-destructive">
                  {completeForm.formState.errors.actual_qty.message}
                </span>
              ) : null}
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              Batch number
              <input
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
                {...completeForm.register('batch_number')}
              />
              {completeForm.formState.errors.batch_number ? (
                <span className="text-xs text-destructive">
                  {completeForm.formState.errors.batch_number.message}
                </span>
              ) : null}
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              Quality status
              <select
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                {...completeForm.register('quality_status')}
              >
                {QUALITY_STATUSES.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              Expiry date (optional)
              <input
                type="date"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                {...completeForm.register('expiry_date')}
              />
            </label>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCompleteDialog(false);
                  completeForm.reset();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={completeMutation.isPending}>
                {completeMutation.isPending ? 'Completing…' : 'Complete production'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Partial-consumption confirm ── */}
      <ConfirmDialog
        open={!!pendingComplete}
        onOpenChange={(open) => !open && setPendingComplete(null)}
        title="Complete with partial consumption?"
        description="Some material lines were not fully consumed at Start (consumed_qty < required_qty). Completing now will record the shortfall as variance. Continue?"
        confirmLabel="Complete anyway"
        loading={completeMutation.isPending}
        onConfirm={() => pendingComplete && completeMutation.mutate(pendingComplete)}
      />
    </>
  );
}
