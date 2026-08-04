'use client';

import { useCallback, useMemo, useState } from 'react';
import { useForm, useFieldArray, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Copy,
  Eye,
  Plus,
  Power,
  Trash2,
  X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useUserId } from '@/lib/hooks/useUserId';
import { useRealtimeQuery } from '@/lib/hooks/useRealtimeQuery';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  EmptyState,
  PageHeader,
  Pagination,
  StatusBadge,
} from '@/components/ui/enterprise';
import { DataTableSkeleton } from '@/components/ui/DataTableSkeleton';
import type { Tables } from '@/lib/supabase/database.types';
import { computeBomLineCost } from '@/lib/stock/manufacturing';
import { formatCurrency } from '@/lib/utils/format';
import { writeAuditLog } from '@/lib/audit/write-audit-log';

const PAGE_SIZE = 20;

/* ───────────────────── types ───────────────────── */

interface ItemEmbed {
  standardized_name: string;
  product_code: string;
  unit?: string | null;
}

interface BomLineWithItem extends Tables<'bom_lines'> {
  items: ItemEmbed | null;
}

interface BomWithRelations extends Tables<'boms'> {
  items: ItemEmbed | null;
  bom_lines: BomLineWithItem[];
}

interface InventoryCostRow {
  item_id: string;
  quantity: number;
  unit_cost: number;
}

interface LineCostDetail {
  line: BomLineWithItem;
  unitCost: number;
  lineCost: number;
}

/* ───────────────────── helpers ───────────────────── */

function bumpVersion(version: string | null): string {
  const v = version ?? '1.0';
  const num = parseFloat(v);
  if (!Number.isNaN(num)) {
    return (num + 0.1).toFixed(1);
  }
  return `${v}.1`;
}

function avgUnitCost(rows: { quantity: number; unit_cost: number }[]): number {
  if (!rows.length) return 0;
  const totalQty = rows.reduce((sum, row) => sum + row.quantity, 0);
  if (totalQty > 0) {
    return rows.reduce((sum, row) => sum + row.quantity * row.unit_cost, 0) / totalQty;
  }
  return rows[0]?.unit_cost ?? 0;
}

const BOM_SELECT =
  '*, items!boms_finished_good_id_fkey(standardized_name, product_code), bom_lines(*, items!bom_lines_raw_material_id_fkey(standardized_name, product_code, unit))';

/* ───────────────────── zod schema ───────────────────── */

const lineSchema = z.object({
  raw_material_id: z.string().min(1, 'Select a material'),
  quantity: z.number().min(0.0001, 'Qty must be > 0'),
  unit: z.string().min(1, 'Unit required'),
  waste_percent: z.number().min(0).max(100),
});

const bomSchema = z.object({
  finished_good_id: z.string().min(1, 'Select a finished good'),
  version: z.string().min(1, 'Version required'),
  yield_qty: z.number().min(0.0001, 'Yield must be > 0'),
  yield_unit: z.string().min(1, 'Yield unit required'),
  notes: z.string(),
  lines: z.array(lineSchema).min(1, 'Add at least one line'),
});

type BomFormValues = z.infer<typeof bomSchema>;

const defaultLine = {
  raw_material_id: '',
  quantity: 1,
  unit: 'kg',
  waste_percent: 0,
};

/* ───────────────────── page ───────────────────── */

export default function BomsPage() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);

  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [detailBom, setDetailBom] = useState<BomWithRelations | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<string | null>(null);
  const [productionOrderCount, setProductionOrderCount] = useState<number | null>(null);

  /* ── fetch BOMs ── */
  const fetchBoms = useCallback(async (): Promise<{ rows: BomWithRelations[]; total: number }> => {
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error, count } = await supabase
      .from('boms')
      .select(BOM_SELECT, { count: 'exact' })
      .eq('user_id', userId!)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    return {
      rows: (data ?? []) as unknown as BomWithRelations[],
      total: count ?? 0,
    };
  }, [supabase, page, userId]);

  const bomsQuery = useRealtimeQuery<{ rows: BomWithRelations[]; total: number }>(
    ['boms', userId ?? '', page],
    'boms',
    fetchBoms,
    !!userId,
  );

  const boms = bomsQuery.data?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil((bomsQuery.data?.total ?? 0) / PAGE_SIZE));

  /* ── lookup items for create modal ── */
  const finishedGoodsQuery = useRealtimeQuery<Tables<'items'>[]>(
    ['bom-finished-goods', userId ?? ''],
    'items',
    async () => {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', userId!)
        .eq('category', 'FINISHED_GOOD')
        .eq('is_active', true)
        .order('standardized_name');
      if (error) throw error;
      return data ?? [];
    },
    !!userId && showCreate,
  );

  const rawMaterialsQuery = useRealtimeQuery<Tables<'items'>[]>(
    ['bom-raw-materials', userId ?? ''],
    'items',
    async () => {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', userId!)
        .eq('is_active', true)
        .in('category', ['RAW_MATERIAL', 'PACKAGING'])
        .order('standardized_name');
      if (error) throw error;
      return data ?? [];
    },
    !!userId && showCreate,
  );

  const finishedGoods = finishedGoodsQuery.data ?? [];
  const rawMaterials = rawMaterialsQuery.data ?? [];

  /* ── inventory costs for detail panel ── */
  const rawMaterialIds = useMemo(
    () => (detailBom ? detailBom.bom_lines.map((l) => l.raw_material_id) : []),
    [detailBom],
  );

  const inventoryCostsQuery = useRealtimeQuery<InventoryCostRow[]>(
    ['bom-inventory-costs', detailBom?.id ?? '', rawMaterialIds.join(',')],
    'inventory',
    async () => {
      if (!detailBom || rawMaterialIds.length === 0) return [];
      const { data, error } = await supabase
        .from('inventory')
        .select('item_id, quantity, unit_cost')
        .eq('user_id', userId!)
        .in('item_id', rawMaterialIds);
      if (error) throw error;
      return (data ?? []) as InventoryCostRow[];
    },
    !!userId && !!detailBom && rawMaterialIds.length > 0,
  );

  const inventoryCosts = inventoryCostsQuery.data ?? [];

  const lineCostDetails = useMemo<LineCostDetail[]>(() => {
    if (!detailBom) return [];
    return detailBom.bom_lines.map((line) => {
      const rows = inventoryCosts.filter((r) => r.item_id === line.raw_material_id);
      const unitCost = avgUnitCost(rows);
      const lineCost = computeBomLineCost(
        line.quantity,
        unitCost,
        line.waste_percent ?? 0,
      );
      return { line, unitCost, lineCost };
    });
  }, [detailBom, inventoryCosts]);

  const totalLineCost = lineCostDetails.reduce((sum, d) => sum + d.lineCost, 0);
  const yieldQty = detailBom?.yield_qty ?? 1;
  const costPerUnit = yieldQty > 0 ? totalLineCost / yieldQty : 0;

  /* ── form ── */
  const form = useForm<BomFormValues>({
    resolver: zodResolver(bomSchema) as Resolver<BomFormValues>,
    defaultValues: {
      finished_good_id: '',
      version: '1.0',
      yield_qty: 1,
      yield_unit: 'unit',
      notes: '',
      lines: [{ ...defaultLine }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'lines',
  });

  function openCreate() {
    form.reset({
      finished_good_id: '',
      version: '1.0',
      yield_qty: 1,
      yield_unit: 'unit',
      notes: '',
      lines: [{ ...defaultLine }],
    });
    setShowCreate(true);
  }

  function closeCreate() {
    setShowCreate(false);
    form.reset();
  }

  function onMaterialChange(index: number, materialId: string) {
    const material = rawMaterials.find((m) => m.id === materialId);
    if (material?.unit) {
      form.setValue(`lines.${index}.unit`, material.unit);
    }
  }

  /* ── create mutation ── */
  const createMutation = useMutation({
    mutationFn: async (values: BomFormValues) => {
      if (!userId) throw new Error('Not authenticated');

      const { data: bom, error: bomErr } = await supabase
        .from('boms')
        .insert({
          user_id: userId,
          finished_good_id: values.finished_good_id,
          version: values.version,
          yield_qty: values.yield_qty,
          yield_unit: values.yield_unit,
          notes: values.notes || null,
          is_active: true,
        })
        .select('id')
        .single();

      if (bomErr) throw bomErr;

      const lineRows = values.lines.map((line) => ({
        user_id: userId,
        bom_id: bom.id,
        raw_material_id: line.raw_material_id,
        quantity: line.quantity,
        unit: line.unit,
        waste_percent: line.waste_percent,
      }));

      const { error: linesErr } = await supabase.from('bom_lines').insert(lineRows);
      if (linesErr) throw linesErr;

      await writeAuditLog({
        userId,
        action: 'CREATE',
        entityType: 'bom',
        entityId: bom.id,
        newValues: {
          finished_good_id: values.finished_good_id,
          version: values.version,
          yield_qty: values.yield_qty,
          line_count: values.lines.length,
        },
      });
    },
    onSuccess: () => {
      toast.success('BOM created');
      void queryClient.invalidateQueries({ queryKey: ['boms'] });
      closeCreate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /* ── new version mutation ── */
  const newVersionMutation = useMutation({
    mutationFn: async (bom: BomWithRelations) => {
      if (!userId) throw new Error('Not authenticated');

      const newVersion = bumpVersion(bom.version);

      const { data: newBom, error: insertErr } = await supabase
        .from('boms')
        .insert({
          user_id: userId,
          finished_good_id: bom.finished_good_id,
          version: newVersion,
          yield_qty: bom.yield_qty,
          yield_unit: bom.yield_unit,
          notes: bom.notes,
          is_active: true,
        })
        .select('id')
        .single();

      if (insertErr) throw insertErr;

      const { error: deactivateErr } = await supabase
        .from('boms')
        .update({ is_active: false })
        .eq('id', bom.id)
        .eq('user_id', userId);

      if (deactivateErr) throw deactivateErr;

      if (bom.bom_lines.length > 0) {
        const clonedLines = bom.bom_lines.map((line) => ({
          user_id: userId,
          bom_id: newBom.id,
          raw_material_id: line.raw_material_id,
          quantity: line.quantity,
          unit: line.unit,
          waste_percent: line.waste_percent ?? 0,
        }));

        const { error: cloneErr } = await supabase.from('bom_lines').insert(clonedLines);
        if (cloneErr) throw cloneErr;
      }

      await writeAuditLog({
        userId,
        action: 'UPDATE',
        entityType: 'bom',
        entityId: bom.id,
        oldValues: { version: bom.version, is_active: true },
        newValues: { version: newVersion, is_active: false, replaced_by: newBom.id },
      });

      await writeAuditLog({
        userId,
        action: 'CREATE',
        entityType: 'bom',
        entityId: newBom.id,
        newValues: {
          finished_good_id: bom.finished_good_id,
          version: newVersion,
          superseded_bom_id: bom.id,
        },
      });

      return newVersion;
    },
    onSuccess: (newVersion) => {
      toast.success(`New BOM version ${newVersion} created`);
      void queryClient.invalidateQueries({ queryKey: ['boms'] });
      setDetailBom(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /* ── deactivate mutation ── */
  const deactivateMutation = useMutation({
    mutationFn: async (bomId: string) => {
      if (!userId) throw new Error('Not authenticated');

      const { count, error: countErr } = await supabase
        .from('production_orders')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('bom_id', bomId);

      if (countErr) throw countErr;

      const { error } = await supabase
        .from('boms')
        .update({ is_active: false })
        .eq('id', bomId)
        .eq('user_id', userId);

      if (error) throw error;

      await writeAuditLog({
        userId,
        action: 'DELETE',
        entityType: 'bom',
        entityId: bomId,
        oldValues: { is_active: true },
        newValues: { is_active: false },
      });

      return count ?? 0;
    },
    onSuccess: (poCount) => {
      if (poCount > 0) {
        toast.success(`BOM deactivated (${poCount} production order${poCount === 1 ? '' : 's'} reference it)`);
      } else {
        toast.success('BOM deactivated');
      }
      void queryClient.invalidateQueries({ queryKey: ['boms'] });
      setConfirmDeactivate(null);
      setProductionOrderCount(null);
      setDetailBom(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function openDeactivate(bomId: string) {
    if (!userId) return;
    const { count } = await supabase
      .from('production_orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('bom_id', bomId);
    setProductionOrderCount(count ?? 0);
    setConfirmDeactivate(bomId);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bill of Materials"
        description="Define recipes, track material costs, and manage BOM versions."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Create BOM
          </Button>
        }
      />

      <Card className="overflow-hidden">
        {bomsQuery.isLoading ? (
          <div className="p-4">
            <DataTableSkeleton rows={5} cols={6} />
          </div>
        ) : boms.length === 0 ? (
          <EmptyState
            title="No BOMs yet"
            description="Create a bill of materials to define how finished goods are produced from raw materials."
            action={
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Create first BOM
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b border-border bg-muted text-xs font-medium uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Finished good</th>
                  <th className="px-4 py-3">Product code</th>
                  <th className="px-4 py-3">Version</th>
                  <th className="px-4 py-3">Yield</th>
                  <th className="px-4 py-3">Lines</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {boms.map((bom) => (
                  <tr key={bom.id} className="border-b border-border/70 last:border-0">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {bom.items?.standardized_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {bom.items?.product_code ?? '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">{bom.version ?? '—'}</td>
                    <td className="px-4 py-3 text-foreground">
                      {bom.yield_qty} {bom.yield_unit}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {bom.bom_lines?.length ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={bom.is_active ? 'ACTIVE' : 'INACTIVE'} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {bom.created_at
                        ? new Date(bom.created_at).toLocaleDateString('en-IN')
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setDetailBom(bom)}
                          className="text-muted-foreground hover:text-foreground"
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {bom.is_active && (
                          <>
                            <button
                              type="button"
                              onClick={() => newVersionMutation.mutate(bom)}
                              className="text-muted-foreground hover:text-foreground"
                              title="Create new version"
                              disabled={newVersionMutation.isPending}
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void openDeactivate(bom.id)}
                              className="text-muted-foreground hover:text-destructive"
                              title="Deactivate"
                            >
                              <Power className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 ? (
          <div className="border-t border-border px-4 py-3">
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        ) : null}
      </Card>

      {/* ── Detail panel ── */}
      {detailBom && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/30"
          role="presentation"
          onClick={() => setDetailBom(null)}
        >
          <div
            className="h-full w-full max-w-lg overflow-y-auto bg-card p-6 shadow-xl"
            role="dialog"
            aria-label="BOM details"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {detailBom.items?.standardized_name ?? 'BOM Details'}
                </h2>
                <p className="font-mono text-xs text-muted-foreground">
                  {detailBom.items?.product_code} · v{detailBom.version}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailBom(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">Yield</p>
                <p className="font-medium">
                  {detailBom.yield_qty} {detailBom.yield_unit}
                </p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">Status</p>
                <StatusBadge status={detailBom.is_active ? 'ACTIVE' : 'INACTIVE'} />
              </div>
            </div>

            {detailBom.notes ? (
              <p className="mb-4 text-sm text-muted-foreground">{detailBom.notes}</p>
            ) : null}

            <h3 className="mb-2 text-sm font-semibold text-foreground">Material lines</h3>

            {inventoryCostsQuery.isLoading ? (
              <DataTableSkeleton rows={3} cols={3} />
            ) : lineCostDetails.length === 0 ? (
              <p className="text-sm text-muted-foreground">No lines defined.</p>
            ) : (
              <div className="space-y-3">
                {lineCostDetails.map(({ line, unitCost, lineCost }) => (
                  <div key={line.id} className="rounded-md border border-border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-foreground">
                          {line.items?.standardized_name ?? 'Unknown'}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {line.items?.product_code}
                        </p>
                      </div>
                      <p className="font-medium tabular-nums">{formatCurrency(lineCost)}</p>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        Qty: {line.quantity} {line.unit}
                      </span>
                      <span>Waste: {line.waste_percent ?? 0}%</span>
                      <span>Avg cost: {formatCurrency(unitCost)}/{line.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 space-y-2 rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total material cost</span>
                <span className="font-medium tabular-nums">{formatCurrency(totalLineCost)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold">
                <span>Est. cost per unit produced</span>
                <span className="tabular-nums text-primary">{formatCurrency(costPerUnit)}</span>
              </div>
            </div>

            {detailBom.is_active && (
              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => newVersionMutation.mutate(detailBom)}
                  disabled={newVersionMutation.isPending}
                >
                  <Copy className="h-4 w-4" />
                  New version
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void openDeactivate(detailBom.id)}
                >
                  <Power className="h-4 w-4" />
                  Deactivate
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Create BOM modal ── */}
      <Dialog open={showCreate} onOpenChange={(open) => !open && closeCreate()}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create BOM</DialogTitle>
            <DialogDescription>
              Define a recipe linking a finished good to its raw materials and packaging.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-medium text-muted-foreground sm:col-span-2">
                Finished good
                <select
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  {...form.register('finished_good_id')}
                >
                  <option value="">Select finished good…</option>
                  {finishedGoods.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.standardized_name} ({item.product_code})
                    </option>
                  ))}
                </select>
                {form.formState.errors.finished_good_id ? (
                  <span className="text-xs text-destructive">
                    {form.formState.errors.finished_good_id.message}
                  </span>
                ) : null}
              </label>

              <label className="block text-xs font-medium text-muted-foreground">
                Version
                <input
                  type="text"
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  {...form.register('version')}
                />
              </label>

              <label className="block text-xs font-medium text-muted-foreground">
                Yield quantity
                <input
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  {...form.register('yield_qty', { valueAsNumber: true })}
                />
              </label>

              <label className="block text-xs font-medium text-muted-foreground">
                Yield unit
                <input
                  type="text"
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  {...form.register('yield_unit')}
                />
              </label>

              <label className="block text-xs font-medium text-muted-foreground sm:col-span-2">
                Notes
                <textarea
                  rows={2}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  {...form.register('notes')}
                />
              </label>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-semibold">Material lines</h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ ...defaultLine })}
                >
                  <Plus className="h-4 w-4" />
                  Add line
                </Button>
              </div>

              {form.formState.errors.lines?.message ? (
                <p className="mb-2 text-xs text-destructive">
                  {form.formState.errors.lines.message}
                </p>
              ) : null}

              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-12"
                  >
                    <label className="text-xs font-medium text-muted-foreground sm:col-span-5">
                      Material
                      <select
                        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                        {...form.register(`lines.${index}.raw_material_id`)}
                        onChange={(e) => {
                          form.register(`lines.${index}.raw_material_id`).onChange(e);
                          onMaterialChange(index, e.target.value);
                        }}
                      >
                        <option value="">Select…</option>
                        {rawMaterials.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.standardized_name} ({item.product_code})
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="text-xs font-medium text-muted-foreground sm:col-span-2">
                      Qty
                      <input
                        type="number"
                        step="0.0001"
                        min="0.0001"
                        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                        {...form.register(`lines.${index}.quantity`, { valueAsNumber: true })}
                      />
                    </label>

                    <label className="text-xs font-medium text-muted-foreground sm:col-span-2">
                      Unit
                      <input
                        type="text"
                        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                        {...form.register(`lines.${index}.unit`)}
                      />
                    </label>

                    <label className="text-xs font-medium text-muted-foreground sm:col-span-2">
                      Waste %
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                        {...form.register(`lines.${index}.waste_percent`, { valueAsNumber: true })}
                      />
                    </label>

                    <div className="flex items-end sm:col-span-1">
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(index)}
                          aria-label="Remove line"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeCreate}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating…' : 'Create BOM'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Deactivate confirm ── */}
      <Dialog
        open={!!confirmDeactivate}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmDeactivate(null);
            setProductionOrderCount(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate BOM?</DialogTitle>
            <DialogDescription>
              {productionOrderCount != null && productionOrderCount > 0
                ? `This BOM is referenced by ${productionOrderCount} production order${productionOrderCount === 1 ? '' : 's'}. It will be soft-deactivated (not deleted).`
                : 'This BOM will be marked inactive. It will not be deleted.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmDeactivate(null);
                setProductionOrderCount(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deactivateMutation.isPending}
              onClick={() => confirmDeactivate && deactivateMutation.mutate(confirmDeactivate)}
            >
              {deactivateMutation.isPending ? 'Deactivating…' : 'Deactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
