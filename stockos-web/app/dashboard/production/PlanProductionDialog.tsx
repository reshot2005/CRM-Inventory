'use client';

import { useMemo } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { useRealtimeQuery } from '@/lib/hooks/useRealtimeQuery';
import { useLocations } from '@/lib/hooks/useLocations';
import { generateOrderNumber } from '@/lib/stock/movements';
import { computeRequiredQty } from '@/lib/stock/manufacturing';
import type { BomWithLines, MachineEmbed } from './types';
import { writeAuditLog } from '@/lib/audit/write-audit-log';

const planSchema = z.object({
  bom_id: z.string().min(1, 'Select a BOM'),
  target_qty: z.number().min(0.0001, 'Target must be > 0'),
  deadline: z.string(),
  machine_id: z.string(),
  location_id: z.string().min(1, 'Select a production location'),
  notes: z.string(),
});

type PlanFormValues = z.infer<typeof planSchema>;

const BOM_SELECT =
  '*, items!boms_finished_good_id_fkey(id, standardized_name, product_code, unit), bom_lines(*, items!bom_lines_raw_material_id_fkey(id, standardized_name, product_code, unit))';

export function PlanProductionDialog({
  open,
  onOpenChange,
  userId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
}) {
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);

  const bomsQuery = useRealtimeQuery<BomWithLines[]>(
    ['production-active-boms', userId ?? ''],
    'boms',
    async () => {
      const { data, error } = await supabase
        .from('boms')
        .select(BOM_SELECT)
        .eq('user_id', userId!)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as BomWithLines[];
    },
    !!userId && open,
  );

  const locationsQuery = useLocations(userId);
  const locations = locationsQuery.data ?? [];

  const machinesQuery = useRealtimeQuery<MachineEmbed[]>(
    ['production-machines-lookup', userId ?? ''],
    'machines',
    async () => {
      const { data, error } = await supabase
        .from('machines')
        .select('id, name, code, status')
        .eq('user_id', userId!)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
    !!userId && open,
  );

  const boms = bomsQuery.data ?? [];
  const machines = machinesQuery.data ?? [];

  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planSchema) as Resolver<PlanFormValues>,
    defaultValues: {
      bom_id: '',
      target_qty: 1,
      deadline: '',
      machine_id: '',
      location_id: '',
      notes: '',
    },
  });

  const selectedBom = boms.find((b) => b.id === form.watch('bom_id')) ?? null;
  const targetQty = form.watch('target_qty') || 0;

  const previewLines = useMemo(() => {
    if (!selectedBom) return [];
    return selectedBom.bom_lines.map((line) => ({
      line,
      requiredQty: computeRequiredQty(
        line.quantity,
        targetQty,
        selectedBom.yield_qty ?? 1,
        line.waste_percent ?? 0,
      ),
    }));
  }, [selectedBom, targetQty]);

  function closeDialog() {
    onOpenChange(false);
    form.reset();
  }

  const planMutation = useMutation({
    mutationFn: async (values: PlanFormValues) => {
      if (!userId) throw new Error('Not authenticated');
      const bom = boms.find((b) => b.id === values.bom_id);
      if (!bom) throw new Error('BOM not found');
      if (bom.bom_lines.length === 0) throw new Error('This BOM has no material lines');

      const lines = bom.bom_lines.map((line) => ({
        raw_material_id: line.raw_material_id,
        required_qty: computeRequiredQty(
          line.quantity,
          values.target_qty,
          bom.yield_qty ?? 1,
          line.waste_percent ?? 0,
        ),
        item_name: line.items?.standardized_name ?? 'Unknown material',
      }));

      const orderNumber = await generateOrderNumber(userId, 'PRD');

      const { data: order, error: orderErr } = await supabase
        .from('production_orders')
        .insert({
          user_id: userId,
          created_by: userId,
          order_number: orderNumber,
          bom_id: values.bom_id,
          target_qty: values.target_qty,
          status: 'PLANNED',
          deadline: values.deadline || null,
          machine_id: values.machine_id || null,
          location_id: values.location_id,
          notes: values.notes.trim() || null,
        })
        .select('id, order_number')
        .single();
      if (orderErr) throw new Error(orderErr.message);

      const lineRows = lines.map((line) => ({
        user_id: userId,
        production_order_id: order.id,
        raw_material_id: line.raw_material_id,
        required_qty: line.required_qty,
      }));

      const { error: linesErr } = await supabase
        .from('production_material_lines')
        .insert(lineRows);
      if (linesErr) throw new Error(linesErr.message);

      await writeAuditLog({
        userId,
        action: 'CREATE',
        entityType: 'production_order',
        entityId: order.id,
        newValues: {
          order_number: order.order_number,
          bom_id: values.bom_id,
          target_qty: values.target_qty,
          status: 'PLANNED',
          location_id: values.location_id,
        },
      });

      // Non-blocking stock check — the order is still created; Start Production
      // performs the authoritative, blocking check before any consumption.
      const { data: inventoryRows } = await supabase
        .from('inventory')
        .select('item_id, quantity')
        .eq('user_id', userId)
        .eq('location_id', values.location_id)
        .in(
          'item_id',
          lines.map((l) => l.raw_material_id),
        );

      const shortages = lines.filter((line) => {
        const available = (inventoryRows ?? [])
          .filter((r) => r.item_id === line.raw_material_id)
          .reduce((sum, r) => sum + Number(r.quantity), 0);
        return available < line.required_qty;
      });

      return { order, shortages };
    },
    onSuccess: ({ order, shortages }) => {
      if (shortages.length > 0) {
        toast.warning(
          `${order.order_number} planned — short on: ${shortages.map((s) => s.item_name).join(', ')}`,
        );
      } else {
        toast.success(`Production order ${order.order_number} planned`);
      }
      void queryClient.invalidateQueries({ queryKey: ['production_orders'] });
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to plan production'),
  });

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? closeDialog() : onOpenChange(next))}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Plan production</DialogTitle>
          <DialogDescription>
            Select a bill of materials and target quantity — required raw materials are
            calculated automatically.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit((values) => planMutation.mutate(values))}
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-medium text-muted-foreground sm:col-span-2">
              Bill of materials
              <select
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                {...form.register('bom_id')}
              >
                <option value="">Select BOM…</option>
                {boms.map((bom) => (
                  <option key={bom.id} value={bom.id}>
                    {bom.items?.standardized_name ?? 'Unknown FG'} · v{bom.version} ({bom.yield_qty}{' '}
                    {bom.yield_unit})
                  </option>
                ))}
              </select>
              {form.formState.errors.bom_id ? (
                <span className="text-xs text-destructive">
                  {form.formState.errors.bom_id.message}
                </span>
              ) : null}
              {!bomsQuery.isLoading && boms.length === 0 ? (
                <span className="text-xs text-amber-600">
                  No active BOMs found — create one under Bill of Materials first.
                </span>
              ) : null}
            </label>

            <label className="block text-xs font-medium text-muted-foreground">
              Target quantity
              <input
                type="number"
                step="0.0001"
                min="0.0001"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                {...form.register('target_qty', { valueAsNumber: true })}
              />
              {form.formState.errors.target_qty ? (
                <span className="text-xs text-destructive">
                  {form.formState.errors.target_qty.message}
                </span>
              ) : null}
            </label>

            <label className="block text-xs font-medium text-muted-foreground">
              Deadline (optional)
              <input
                type="date"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                {...form.register('deadline')}
              />
            </label>

            <label className="block text-xs font-medium text-muted-foreground">
              Production location
              <select
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                {...form.register('location_id')}
              >
                <option value="">Select location…</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.code})
                  </option>
                ))}
              </select>
              {form.formState.errors.location_id ? (
                <span className="text-xs text-destructive">
                  {form.formState.errors.location_id.message}
                </span>
              ) : null}
            </label>

            <label className="block text-xs font-medium text-muted-foreground">
              Machine (optional)
              <select
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                {...form.register('machine_id')}
              >
                <option value="">Unassigned</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.code})
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-medium text-muted-foreground sm:col-span-2">
              Notes (optional)
              <textarea
                rows={2}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                {...form.register('notes')}
              />
            </label>
          </div>

          {previewLines.length > 0 ? (
            <div>
              <h4 className="mb-2 text-sm font-semibold text-foreground">
                Required raw materials
              </h4>
              <div className="space-y-2 rounded-md border border-border p-3">
                {previewLines.map(({ line, requiredQty }) => (
                  <div key={line.id} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">
                      {line.items?.standardized_name ?? 'Unknown material'}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {requiredQty} {line.items?.unit ?? line.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button type="submit" disabled={planMutation.isPending}>
              {planMutation.isPending ? 'Planning…' : 'Plan production'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
