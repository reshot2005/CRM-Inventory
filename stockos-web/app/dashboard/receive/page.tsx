'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PackageCheck } from 'lucide-react';
import {
  CurrencyDisplay,
  EmptyState,
  PageHeader,
  Pagination,
  StatusBadge,
} from '@/components/ui/enterprise';
import { DataTableSkeleton } from '@/components/ui/DataTableSkeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient, type Tables } from '@/lib/supabase/client';
import { useUserId } from '@/lib/hooks/useUserId';
import { useLocations } from '@/lib/hooks/useLocations';
import { useRealtimeQuery } from '@/lib/hooks/useRealtimeQuery';
import { processStockMovement } from '@/lib/stock/movements';
import { insertNotification } from '@/lib/stock/manufacturing';
import { formatCurrency } from '@/lib/utils/format';
import { writeAuditLog } from '@/lib/audit/write-audit-log';

const PAGE_SIZE = 20;

type POStatus = 'SENT' | 'PARTIALLY_RECEIVED' | 'RECEIVED';

interface POLineWithItem extends Tables<'purchase_order_lines'> {
  items: {
    standardized_name: string;
    product_code: string;
    unit: string | null;
  } | null;
}

interface POWithDetails extends Tables<'purchase_orders'> {
  vendors: { company_name: string } | null;
  purchase_order_lines: POLineWithItem[];
}

interface ReceiveLineInput {
  lineId: string;
  itemId: string;
  unitPrice: number;
  orderedQty: number;
  alreadyReceived: number;
  receivingNow: number;
}

function invalidateReceiveQueries(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
  void queryClient.invalidateQueries({ queryKey: ['receive-pos'] });
  void queryClient.invalidateQueries({ queryKey: ['inventory'] });
  void queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
  void queryClient.invalidateQueries({ queryKey: ['low-stock'] });
  void queryClient.invalidateQueries({ queryKey: ['items'] });
  void queryClient.invalidateQueries({ queryKey: ['dashboard-ledger'] });
}

export default function ReceiveStockPage() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);
  const { data: locations = [], isLoading: locationsLoading } = useLocations(userId);

  const [page, setPage] = useState(1);
  const [expandedPoId, setExpandedPoId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState('');
  const [lineInputs, setLineInputs] = useState<Record<string, number>>({});

  const posQuery = useRealtimeQuery<{ rows: POWithDetails[]; total: number }>(
    ['receive-pos', userId ?? '', page],
    'purchase_orders',
    async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error, count } = await supabase
        .from('purchase_orders')
        .select(
          '*, vendors(company_name), purchase_order_lines(*, items(standardized_name, product_code, unit))',
          { count: 'exact' },
        )
        .eq('user_id', userId!)
        .in('status', ['SENT', 'PARTIALLY_RECEIVED'])
        .order('created_at', { ascending: false })
        .range(from, to);
      if (error) throw error;
      return {
        rows: (data ?? []) as unknown as POWithDetails[],
        total: count ?? 0,
      };
    },
    !!userId,
  );

  const purchaseOrders = posQuery.data?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil((posQuery.data?.total ?? 0) / PAGE_SIZE));

  const expandedPo = purchaseOrders.find((po) => po.id === expandedPoId) ?? null;

  useEffect(() => {
    if (expandedPoId && locations.length > 0 && !locationId) {
      setLocationId(locations[0].id);
    }
  }, [expandedPoId, locations, locationId]);

  const openReceiveForm = useCallback((po: POWithDetails) => {
    setExpandedPoId(po.id);
    setLocationId(locations[0]?.id ?? '');
    const initial: Record<string, number> = {};
    for (const line of po.purchase_order_lines) {
      initial[line.id] = 0;
    }
    setLineInputs(initial);
  }, [locations]);

  const togglePo = useCallback(
    (po: POWithDetails) => {
      if (expandedPoId === po.id) {
        setExpandedPoId(null);
        setLineInputs({});
        return;
      }
      openReceiveForm(po);
    },
    [expandedPoId, openReceiveForm],
  );

  const receiveMutation = useMutation({
    mutationFn: async () => {
      if (!userId || !expandedPo) throw new Error('Not authenticated');
      if (!locationId) throw new Error('Select a receiving location');

      const lines: ReceiveLineInput[] = expandedPo.purchase_order_lines
        .map((line) => ({
          lineId: line.id,
          itemId: line.item_id,
          unitPrice: line.unit_price,
          orderedQty: line.ordered_qty,
          alreadyReceived: line.received_qty ?? 0,
          receivingNow: lineInputs[line.id] ?? 0,
        }))
        .filter((l) => l.receivingNow > 0);

      if (lines.length === 0) {
        throw new Error('Enter quantity for at least one line');
      }

      for (const line of lines) {
        const remaining = line.orderedQty - line.alreadyReceived;
        if (line.receivingNow > remaining) {
          throw new Error(
            `Cannot receive ${line.receivingNow} — only ${remaining} remaining on a line`,
          );
        }
      }

      for (const line of lines) {
        await processStockMovement({
          userId,
          locationId,
          itemId: line.itemId,
          movementType: 'PURCHASE_RECEIVE',
          quantity: line.receivingNow,
          unitCost: line.unitPrice,
          referenceType: 'PURCHASE_ORDER',
          referenceId: expandedPo.id,
          notes: `Received from PO ${expandedPo.po_number}`,
          createdBy: userId,
        });

        const newReceivedQty = line.alreadyReceived + line.receivingNow;
        const { error: lineErr } = await supabase
          .from('purchase_order_lines')
          .update({ received_qty: newReceivedQty })
          .eq('id', line.lineId);
        if (lineErr) throw new Error(lineErr.message);
      }

      const { data: updatedLines, error: fetchErr } = await supabase
        .from('purchase_order_lines')
        .select('ordered_qty, received_qty')
        .eq('purchase_order_id', expandedPo.id);
      if (fetchErr) throw new Error(fetchErr.message);

      const allReceived = (updatedLines ?? []).every(
        (l) => (l.received_qty ?? 0) >= l.ordered_qty,
      );
      const newStatus: POStatus = allReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED';

      const { error: poErr } = await supabase
        .from('purchase_orders')
        .update({ status: newStatus })
        .eq('id', expandedPo.id);
      if (poErr) throw new Error(poErr.message);

      await writeAuditLog({
        userId,
        action: 'UPDATE',
        entityType: 'purchase_order',
        entityId: expandedPo.id,
        newValues: {
          po_number: expandedPo.po_number,
          status: newStatus,
          location_id: locationId,
          lines_received: lines.length,
        },
      });
    },
    onSuccess: () => {
      toast.success('Stock received successfully');
      setExpandedPoId(null);
      setLineInputs({});
      if (userId) {
        void insertNotification({
          userId,
          type: 'PO_RECEIVED',
          title: 'Stock received',
          body: 'Purchase order stock posted to inventory',
          link: '/dashboard/receive',
        });
      }
      invalidateReceiveQueries(queryClient);
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to receive stock'),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Receive Stock"
        description="Receive incoming purchase orders into your locations."
      />

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        {posQuery.isLoading ? (
          <div className="p-4">
            <DataTableSkeleton rows={5} cols={6} />
          </div>
        ) : purchaseOrders.length === 0 ? (
          <EmptyState
            title="No POs awaiting receipt"
            description="Purchase orders with status Sent or Partially Received will appear here."
          />
        ) : (
          <div className="divide-y divide-border">
            {purchaseOrders.map((po) => {
              const isExpanded = expandedPoId === po.id;
              const pendingLines = po.purchase_order_lines.filter(
                (l) => (l.received_qty ?? 0) < l.ordered_qty,
              );

              return (
                <div key={po.id}>
                  <button
                    type="button"
                    onClick={() => togglePo(po)}
                    className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-muted/40"
                  >
                    <PackageCheck className="h-5 w-5 shrink-0 text-emerald-600" />
                    <span className="font-mono font-medium text-primary">{po.po_number}</span>
                    <span className="text-sm text-foreground">
                      {po.vendors?.company_name ?? '—'}
                    </span>
                    <StatusBadge status={po.status ?? 'SENT'} />
                    <span className="ml-auto text-sm font-medium">
                      <CurrencyDisplay value={po.total_amount} />
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {pendingLines.length} line{pendingLines.length === 1 ? '' : 's'} pending
                    </span>
                  </button>

                  {isExpanded && expandedPo ? (
                    <div className="border-t border-border bg-muted/20 px-4 py-4">
                      <div className="mb-4 max-w-xs">
                        <label className="block text-sm font-medium text-foreground">
                          Receiving location
                          <select
                            value={locationId}
                            onChange={(e) => setLocationId(e.target.value)}
                            disabled={locationsLoading || locations.length === 0}
                            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                          >
                            <option value="">Select location…</option>
                            {locations.map((loc) => (
                              <option key={loc.id} value={loc.id}>
                                {loc.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        {locations.length === 0 && !locationsLoading ? (
                          <p className="mt-1 text-xs text-amber-600">
                            No active locations — create one in Admin → Locations.
                          </p>
                        ) : null}
                      </div>

                      <div className="overflow-x-auto rounded-md border border-border bg-card">
                        <table className="w-full min-w-[640px] text-left text-sm">
                          <thead className="border-b border-border bg-muted text-xs font-medium uppercase text-muted-foreground">
                            <tr>
                              <th className="px-3 py-2">Item</th>
                              <th className="px-3 py-2">Code</th>
                              <th className="px-3 py-2 text-right">Ordered</th>
                              <th className="px-3 py-2 text-right">Received</th>
                              <th className="px-3 py-2 text-right">Remaining</th>
                              <th className="px-3 py-2 text-right">Unit price</th>
                              <th className="px-3 py-2">Receiving now</th>
                            </tr>
                          </thead>
                          <tbody>
                            {expandedPo.purchase_order_lines.map((line) => {
                              const received = line.received_qty ?? 0;
                              const remaining = line.ordered_qty - received;
                              const fullyReceived = remaining <= 0;

                              return (
                                <tr
                                  key={line.id}
                                  className="border-b border-border/70 last:border-0"
                                >
                                  <td className="px-3 py-2 font-medium">
                                    {line.items?.standardized_name ?? '—'}
                                  </td>
                                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                                    {line.items?.product_code ?? '—'}
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums">
                                    {line.ordered_qty}
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums">
                                    {received}
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums">
                                    {fullyReceived ? (
                                      <span className="text-emerald-600">0</span>
                                    ) : (
                                      remaining
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    {formatCurrency(line.unit_price)}
                                  </td>
                                  <td className="px-3 py-2">
                                    {fullyReceived ? (
                                      <span className="text-xs text-emerald-600">Complete</span>
                                    ) : (
                                      <Input
                                        type="number"
                                        min={0}
                                        max={remaining}
                                        step="any"
                                        value={lineInputs[line.id] ?? 0}
                                        onChange={(e) =>
                                          setLineInputs((prev) => ({
                                            ...prev,
                                            [line.id]: Math.max(
                                              0,
                                              Number(e.target.value) || 0,
                                            ),
                                          }))
                                        }
                                        className="h-8 w-24 text-right"
                                      />
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div className="mt-4 flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setExpandedPoId(null);
                            setLineInputs({});
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          disabled={
                            receiveMutation.isPending ||
                            !locationId ||
                            pendingLines.length === 0
                          }
                          onClick={() => receiveMutation.mutate()}
                        >
                          {receiveMutation.isPending ? 'Receiving…' : 'Confirm receive'}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 ? (
          <div className="border-t border-border px-4 py-3">
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
