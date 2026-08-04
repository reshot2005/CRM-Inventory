'use client';

import { useMemo, useRef, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Check,
  ClipboardList,
  Download,
  Plus,
  SlidersHorizontal,
  Upload,
  X,
} from 'lucide-react';
import {
  EmptyState,
  PageHeader,
  Pagination,
  StatusBadge,
} from '@/components/ui/enterprise';
import { DataTableSkeleton } from '@/components/ui/DataTableSkeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CsvImportDialog } from '@/components/csv/CsvImportDialog';
import { createClient, type Tables } from '@/lib/supabase/client';
import { useUserId } from '@/lib/hooks/useUserId';
import { useOrgRole } from '@/lib/hooks/useOrgRole';
import { useLocations } from '@/lib/hooks/useLocations';
import { useRealtimeQuery } from '@/lib/hooks/useRealtimeQuery';
import { LOOKUP_KEYS } from '@/lib/query/lookups';
import {
  applyStockAdjustment,
  rejectStockAdjustment,
} from '@/lib/stock/movements';
import { insertNotification } from '@/lib/stock/manufacturing';
import { formatDateTime } from '@/lib/utils/format';
import { writeAuditLog } from '@/lib/audit/write-audit-log';
import {
  applyCountImport,
  applyOpeningImport,
  downloadCountTemplate,
  downloadOpeningTemplate,
  exportCountSheet,
  loadStockCsvLookups,
  previewCountImport,
  previewOpeningImport,
  type CountImportRow,
  type OpeningImportRow,
  type StockCsvLookups,
} from '@/lib/csv/stock-count';

const PAGE_SIZE = 20;

const ADJUSTMENT_TYPES = ['ADD', 'REMOVE', 'CORRECT'] as const;
const REASONS = [
  'DAMAGED',
  'EXPIRED',
  'COUNT_CORRECTION',
  'RETURN_FROM_CUSTOMER',
  'PRODUCTION_WASTE',
  'THEFT',
  'FOUND',
  'OTHER',
] as const;

const adjustmentSchema = z.object({
  item_id: z.string().min(1, 'Select an item'),
  location_id: z.string().min(1, 'Select a location'),
  adjustment_type: z.enum(ADJUSTMENT_TYPES),
  quantity: z.number().refine((v) => v !== 0, 'Quantity cannot be zero'),
  reason: z.enum(REASONS),
  notes: z.string().optional(),
});

type AdjustmentFormValues = z.infer<typeof adjustmentSchema>;

interface ItemOption {
  id: string;
  standardized_name: string;
  product_code: string;
}

interface AdjustmentRow extends Tables<'stock_adjustments'> {
  items: { standardized_name: string; product_code: string } | null;
  locations: { name: string } | null;
}

function invalidateAdjustmentQueries(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['stock_adjustments'] });
  void queryClient.invalidateQueries({ queryKey: ['inventory'] });
  void queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
  void queryClient.invalidateQueries({ queryKey: ['low-stock'] });
  void queryClient.invalidateQueries({ queryKey: ['items'] });
  void queryClient.invalidateQueries({ queryKey: ['dashboard-ledger'] });
}

export default function AdjustmentsPage() {
  const userId = useUserId();
  const { canApproveAdjustments } = useOrgRole();
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);

  const { data: locations = [] } = useLocations(userId);

  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<AdjustmentRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [countImportOpen, setCountImportOpen] = useState(false);
  const [openingImportOpen, setOpeningImportOpen] = useState(false);
  const [applyAfterImport, setApplyAfterImport] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [exportLocId, setExportLocId] = useState('');
  const lookupsRef = useRef<StockCsvLookups | null>(null);
  const countPendingRef = useRef<CountImportRow[]>([]);
  const openingPendingRef = useRef<OpeningImportRow[]>([]);

  const adjustmentsQuery = useRealtimeQuery<{ rows: AdjustmentRow[]; total: number }>(
    ['stock_adjustments', userId ?? '', page],
    'stock_adjustments',
    async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error, count } = await supabase
        .from('stock_adjustments')
        .select(
          '*, items(standardized_name, product_code), locations(name)',
          { count: 'exact' },
        )
        .order('created_at', { ascending: false })
        .range(from, to);
      if (error) throw error;
      return {
        rows: (data ?? []) as unknown as AdjustmentRow[],
        total: count ?? 0,
      };
    },
    !!userId,
  );

  const itemsQuery = useRealtimeQuery<ItemOption[]>(
    LOOKUP_KEYS.items,
    'items',
    async () => {
      const { data, error } = await supabase
        .from('items')
        .select('id, standardized_name, product_code')
        .eq('is_active', true)
        .order('standardized_name');
      if (error) throw error;
      return (data ?? []) as ItemOption[];
    },
    !!userId && showForm,
  );

  const adjustments = adjustmentsQuery.data?.rows ?? [];
  const items = itemsQuery.data ?? [];
  const totalPages = Math.max(
    1,
    Math.ceil((adjustmentsQuery.data?.total ?? 0) / PAGE_SIZE),
  );

  const form = useForm<AdjustmentFormValues>({
    resolver: zodResolver(adjustmentSchema) as Resolver<AdjustmentFormValues>,
    defaultValues: {
      item_id: '',
      location_id: '',
      adjustment_type: 'ADD',
      quantity: 1,
      reason: 'COUNT_CORRECTION',
      notes: '',
    },
  });

  const watchedType = form.watch('adjustment_type');

  const createMutation = useMutation({
    mutationFn: async (values: AdjustmentFormValues) => {
      if (!userId) throw new Error('Not authenticated');

      const rawQty = values.quantity;
      if (values.adjustment_type !== 'CORRECT' && rawQty <= 0) {
        throw new Error('Quantity must be positive for Add or Remove');
      }

      // CORRECT keeps sign; ADD/REMOVE store absolute qty.
      const storedQty =
        values.adjustment_type === 'CORRECT' ? rawQty : Math.abs(rawQty);

      // Always insert PENDING — apply RPC is the only path to APPROVED + stock.
      const { data: adjustment, error: insertErr } = await supabase
        .from('stock_adjustments')
        .insert({
          user_id: userId,
          item_id: values.item_id,
          location_id: values.location_id,
          quantity: storedQty,
          adjustment_type: values.adjustment_type,
          reason: values.reason,
          notes: values.notes?.trim() || null,
          status: 'PENDING',
          approved_by: null,
          approved_at: null,
          created_by: userId,
        })
        .select('id')
        .single();

      if (insertErr) throw new Error(insertErr.message);

      let finalStatus: 'PENDING' | 'APPROVED' = 'PENDING';
      if (canApproveAdjustments) {
        await applyStockAdjustment(userId, adjustment.id);
        finalStatus = 'APPROVED';
      }

      await writeAuditLog({
        userId,
        action: finalStatus === 'APPROVED' ? 'APPROVE' : 'CREATE',
        entityType: 'stock_adjustment',
        entityId: adjustment.id,
        newValues: {
          adjustment_type: values.adjustment_type,
          item_id: values.item_id,
          location_id: values.location_id,
          quantity: storedQty,
          reason: values.reason,
          status: finalStatus,
        },
      });

      return { id: adjustment.id, status: finalStatus };
    },
    onSuccess: (result) => {
      toast.success(
        result.status === 'APPROVED'
          ? 'Stock adjustment applied'
          : 'Adjustment submitted for approval',
      );
      setShowForm(false);
      form.reset();
      if (userId) {
        void insertNotification({
          userId,
          type: 'ADJUSTMENT_PENDING',
          title:
            result.status === 'APPROVED'
              ? 'Stock adjustment applied'
              : 'Adjustment awaiting approval',
          body:
            result.status === 'APPROVED'
              ? 'Inventory updated via adjustment'
              : 'A staff adjustment is pending manager review',
          link: '/dashboard/adjustments',
        });
      }
      invalidateAdjustmentQueries(queryClient);
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create adjustment'),
  });

  const approveMutation = useMutation({
    mutationFn: async (row: AdjustmentRow) => {
      if (!userId) throw new Error('Not authenticated');
      await applyStockAdjustment(userId, row.id);
      await writeAuditLog({
        userId,
        action: 'APPROVE',
        entityType: 'stock_adjustment',
        entityId: row.id,
        newValues: { status: 'APPROVED' },
      });
    },
    onSuccess: () => {
      toast.success('Adjustment approved — stock updated');
      invalidateAdjustmentQueries(queryClient);
    },
    onError: (err: Error) => toast.error(err.message || 'Approve failed'),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ row, reason }: { row: AdjustmentRow; reason: string }) => {
      if (!userId) throw new Error('Not authenticated');
      await rejectStockAdjustment(userId, row.id, reason);
      await writeAuditLog({
        userId,
        action: 'REJECT',
        entityType: 'stock_adjustment',
        entityId: row.id,
        newValues: { status: 'REJECTED', rejection_reason: reason },
      });
    },
    onSuccess: () => {
      toast.success('Adjustment rejected');
      setRejectTarget(null);
      setRejectReason('');
      invalidateAdjustmentQueries(queryClient);
    },
    onError: (err: Error) => toast.error(err.message || 'Reject failed'),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Stock Adjustments"
        description="Add, remove, or correct inventory quantities with a full audit trail. Count/opening CSV creates PENDING rows only — Apply moves stock."
        actions={
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1">
              <select
                aria-label="Count sheet location"
                value={exportLocId}
                onChange={(e) => setExportLocId(e.target.value)}
                className="h-9 rounded-md border border-border bg-muted px-2 text-xs"
              >
                <option value="">All locations</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                disabled={bulkBusy}
                onClick={() => {
                  setBulkBusy(true);
                  void exportCountSheet(exportLocId || null)
                    .then(() => toast.success('Count sheet exported'))
                    .catch((e: Error) => toast.error(e.message))
                    .finally(() => setBulkBusy(false));
                }}
              >
                <Download className="h-4 w-4" />
                Count sheet
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setApplyAfterImport(false);
                countPendingRef.current = [];
                setCountImportOpen(true);
                void loadStockCsvLookups()
                  .then((l) => {
                    lookupsRef.current = l;
                  })
                  .catch((e: Error) => toast.error(e.message));
              }}
            >
              <ClipboardList className="h-4 w-4" />
              Import count
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setApplyAfterImport(false);
                openingPendingRef.current = [];
                setOpeningImportOpen(true);
                void loadStockCsvLookups()
                  .then((l) => {
                    lookupsRef.current = l;
                  })
                  .catch((e: Error) => toast.error(e.message));
              }}
            >
              <Upload className="h-4 w-4" />
              Opening balances
            </Button>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" />
              New adjustment
            </Button>
          </div>
        }
      />

      <CsvImportDialog
        open={countImportOpen}
        onOpenChange={setCountImportOpen}
        title="Import physical count sheet"
        description="Creates PENDING CORRECT adjustments from counted_qty − current stock. Does not change quantity until Apply."
        templateHint="Fill counted_qty; leave blank to skip a row."
        onDownloadTemplate={downloadCountTemplate}
        confirming={bulkBusy}
        extraControls={
          canApproveAdjustments ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={applyAfterImport}
                onChange={(e) => setApplyAfterImport(e.target.checked)}
              />
              Apply after import (manager) — moves stock via ledger
            </label>
          ) : (
            <p className="text-xs text-muted-foreground">
              Rows stay PENDING for manager approval.
            </p>
          )
        }
        onParsed={(rows) => {
          if (!lookupsRef.current) {
            return {
              issues: [
                {
                  row: 0,
                  level: 'error' as const,
                  message: 'Lookups still loading — wait a moment and re-select the file',
                },
              ],
              validCount: 0,
              summary: 'Loading locations/items…',
            };
          }
          const result = previewCountImport(rows, lookupsRef.current);
          countPendingRef.current = result.valid;
          return {
            issues: result.issues,
            validCount: result.validCount,
            summary: result.summary,
          };
        }}
        onConfirm={async () => {
          if (!userId) return;
          const rows = countPendingRef.current;
          if (!rows.length) return;
          setBulkBusy(true);
          try {
            const apply =
              canApproveAdjustments && applyAfterImport;
            const { created, applied } = await applyCountImport(
              userId,
              rows,
              apply,
            );
            toast.success(
              apply
                ? `Count import: ${created} adjustments, ${applied} applied`
                : `Count import: ${created} PENDING adjustments`,
            );
            setCountImportOpen(false);
            countPendingRef.current = [];
            invalidateAdjustmentQueries(queryClient);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Count import failed');
          } finally {
            setBulkBusy(false);
          }
        }}
      />

      <CsvImportDialog
        open={openingImportOpen}
        onOpenChange={setOpeningImportOpen}
        title="Import opening balances"
        description="Creates PENDING ADD adjustments (reason OTHER). Quantity moves only after Apply. Unit cost is not set here — use receive/valuation paths."
        templateHint="opening_qty must be > 0. Catalog must already exist."
        onDownloadTemplate={downloadOpeningTemplate}
        confirming={bulkBusy}
        extraControls={
          canApproveAdjustments ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={applyAfterImport}
                onChange={(e) => setApplyAfterImport(e.target.checked)}
              />
              Apply after import (manager) — moves stock via ledger
            </label>
          ) : (
            <p className="text-xs text-muted-foreground">
              Rows stay PENDING for manager approval.
            </p>
          )
        }
        onParsed={(rows) => {
          if (!lookupsRef.current) {
            return {
              issues: [
                {
                  row: 0,
                  level: 'error' as const,
                  message: 'Lookups still loading — wait a moment and re-select the file',
                },
              ],
              validCount: 0,
              summary: 'Loading locations/items…',
            };
          }
          const result = previewOpeningImport(rows, lookupsRef.current);
          openingPendingRef.current = result.valid;
          return {
            issues: result.issues,
            validCount: result.validCount,
            summary: result.summary,
          };
        }}
        onConfirm={async () => {
          if (!userId) return;
          const rows = openingPendingRef.current;
          if (!rows.length) return;
          setBulkBusy(true);
          try {
            const apply =
              canApproveAdjustments && applyAfterImport;
            const { created, applied } = await applyOpeningImport(
              userId,
              rows,
              apply,
            );
            toast.success(
              apply
                ? `Opening import: ${created} adjustments, ${applied} applied`
                : `Opening import: ${created} PENDING adjustments`,
            );
            setOpeningImportOpen(false);
            openingPendingRef.current = [];
            invalidateAdjustmentQueries(queryClient);
          } catch (e) {
            toast.error(
              e instanceof Error ? e.message : 'Opening import failed',
            );
          } finally {
            setBulkBusy(false);
          }
        }}
      />

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        {adjustmentsQuery.isLoading ? (
          <div className="p-4">
            <DataTableSkeleton rows={5} cols={7} />
          </div>
        ) : adjustments.length === 0 ? (
          <EmptyState
            title="No adjustments yet"
            description="Create an adjustment when stock counts differ from system records."
            action={
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4" />
                Create first adjustment
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-border bg-muted text-xs font-medium uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3">Status</th>
                  {canApproveAdjustments ? (
                    <th className="px-4 py-3 text-right">Actions</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {adjustments.map((row) => {
                  const pending = (row.status ?? 'PENDING') === 'PENDING';
                  const busy =
                    approveMutation.isPending || rejectMutation.isPending;
                  return (
                    <tr key={row.id} className="border-b border-border/70 last:border-0">
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDateTime(row.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{row.items?.standardized_name ?? '—'}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {row.items?.product_code ?? '—'}
                        </p>
                      </td>
                      <td className="px-4 py-3">{row.locations?.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.adjustment_type} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {row.reason.replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">
                        {row.quantity}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.status ?? 'PENDING'} />
                      </td>
                      {canApproveAdjustments ? (
                        <td className="px-4 py-3 text-right">
                          {pending ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                disabled={busy}
                                onClick={() => approveMutation.mutate(row)}
                              >
                                <Check className="h-3.5 w-3.5" />
                                Apply
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => {
                                  setRejectTarget(row);
                                  setRejectReason('');
                                }}
                              >
                                <X className="h-3.5 w-3.5" />
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 ? (
          <div className="border-t border-border px-4 py-3">
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        ) : null}
      </div>

      <Dialog
        open={!!rejectTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null);
            setRejectReason('');
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject adjustment</DialogTitle>
            <DialogDescription>
              Stock will not change. Provide a reason for the audit trail.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="reject-reason">Reason</Label>
            <textarea
              id="reject-reason"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm"
              placeholder="Why is this adjustment rejected?"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectTarget(null);
                setRejectReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={
                rejectReason.trim().length < 3 || rejectMutation.isPending
              }
              onClick={() => {
                if (!rejectTarget) return;
                rejectMutation.mutate({
                  row: rejectTarget,
                  reason: rejectReason.trim(),
                });
              }}
            >
              {rejectMutation.isPending ? 'Rejecting…' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-12">
          <div
            className="w-full max-w-lg rounded-lg bg-card p-6 shadow-xl"
            role="dialog"
            aria-labelledby="adjustment-form-title"
          >
            <div className="mb-4 flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-primary" />
              <h2 id="adjustment-form-title" className="text-lg font-semibold">
                New stock adjustment
              </h2>
            </div>

            <form
              onSubmit={form.handleSubmit((v) => createMutation.mutate(v))}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="adj-item">Item</Label>
                <select
                  id="adj-item"
                  {...form.register('item_id')}
                  className="mt-1 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm"
                >
                  <option value="">Select item…</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.standardized_name} ({item.product_code})
                    </option>
                  ))}
                </select>
                {form.formState.errors.item_id ? (
                  <p className="mt-1 text-xs text-destructive">
                    {form.formState.errors.item_id.message}
                  </p>
                ) : null}
              </div>

              <div>
                <Label htmlFor="adj-location">Location</Label>
                <select
                  id="adj-location"
                  {...form.register('location_id')}
                  className="mt-1 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm"
                >
                  <option value="">Select location…</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
                {form.formState.errors.location_id ? (
                  <p className="mt-1 text-xs text-destructive">
                    {form.formState.errors.location_id.message}
                  </p>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="adj-type">Adjustment type</Label>
                  <select
                    id="adj-type"
                    {...form.register('adjustment_type')}
                    className="mt-1 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm"
                  >
                    {ADJUSTMENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="adj-qty">
                    Quantity
                    {watchedType === 'CORRECT' ? (
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        (+/−)
                      </span>
                    ) : null}
                  </Label>
                  <Input
                    id="adj-qty"
                    type="number"
                    step="any"
                    {...form.register('quantity', { valueAsNumber: true })}
                    className="mt-1"
                  />
                  {form.formState.errors.quantity ? (
                    <p className="mt-1 text-xs text-destructive">
                      {form.formState.errors.quantity.message}
                    </p>
                  ) : null}
                </div>
              </div>

              <div>
                <Label htmlFor="adj-reason">Reason</Label>
                <select
                  id="adj-reason"
                  {...form.register('reason')}
                  className="mt-1 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm"
                >
                  {REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="adj-notes">Notes (optional)</Label>
                <textarea
                  id="adj-notes"
                  rows={2}
                  {...form.register('notes')}
                  className="mt-1 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    form.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending
                    ? canApproveAdjustments
                      ? 'Applying…'
                      : 'Submitting…'
                    : canApproveAdjustments
                      ? 'Apply adjustment'
                      : 'Submit for approval'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
