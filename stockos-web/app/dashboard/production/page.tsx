'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { LayoutGrid, List, Plus, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, PageHeader, Pagination, StatusBadge } from '@/components/ui/enterprise';
import { DataTableSkeleton } from '@/components/ui/DataTableSkeleton';
import { createClient } from '@/lib/supabase/client';
import { useUserId } from '@/lib/hooks/useUserId';
import { useRealtimeQuery } from '@/lib/hooks/useRealtimeQuery';
import { formatDate } from '@/lib/utils/format';
import { PlanProductionDialog } from './PlanProductionDialog';
import { ProductionDetailDrawer } from './ProductionDetailDrawer';
import { MachinesDrawer } from './MachinesDrawer';
import {
  PRODUCTION_STATUSES,
  PRODUCTION_VIEW_STORAGE_KEY,
  type ProductionOrderRow,
  type ProductionStatus,
  type ProductionView,
} from './types';

const PAGE_SIZE = 20;
const KANBAN_LIMIT = 200;

const PRODUCTION_ORDER_SELECT =
  '*, boms!production_orders_bom_id_fkey(*, items!boms_finished_good_id_fkey(id, standardized_name, product_code, unit)), machines!production_orders_machine_id_fkey(id, name, code, status), locations!production_orders_location_id_fkey(id, name, code)';

export default function ProductionOrdersPage() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();

  const [viewMode, setViewMode] = useState<ProductionView>('list');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ProductionStatus>('ALL');
  const [page, setPage] = useState(1);
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [showMachines, setShowMachines] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(PRODUCTION_VIEW_STORAGE_KEY);
    if (stored === 'kanban' || stored === 'list') setViewMode(stored);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(PRODUCTION_VIEW_STORAGE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    const orderParam = searchParams.get('order');
    if (orderParam) setSelectedOrderId(orderParam);
  }, [searchParams]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, viewMode]);

  const fetchList = useCallback(async (): Promise<{ rows: ProductionOrderRow[]; total: number }> => {
    if (!userId) return { rows: [], total: 0 };
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let query = supabase
      .from('production_orders')
      .select(PRODUCTION_ORDER_SELECT, { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (statusFilter !== 'ALL') query = query.eq('status', statusFilter);
    const { data, error, count } = await query.range(from, to);
    if (error) throw error;
    return { rows: (data ?? []) as unknown as ProductionOrderRow[], total: count ?? 0 };
  }, [supabase, userId, page, statusFilter]);

  const fetchKanban = useCallback(async (): Promise<{ rows: ProductionOrderRow[]; total: number }> => {
    if (!userId) return { rows: [], total: 0 };
    const { data, error, count } = await supabase
      .from('production_orders')
      .select(PRODUCTION_ORDER_SELECT, { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(0, KANBAN_LIMIT - 1);
    if (error) throw error;
    return { rows: (data ?? []) as unknown as ProductionOrderRow[], total: count ?? 0 };
  }, [supabase, userId]);

  const ordersQuery = useRealtimeQuery<{ rows: ProductionOrderRow[]; total: number }>(
    ['production_orders', userId ?? '', viewMode, statusFilter, page],
    'production_orders',
    viewMode === 'kanban' ? fetchKanban : fetchList,
    !!userId,
  );

  const orders = ordersQuery.data?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil((ordersQuery.data?.total ?? 0) / PAGE_SIZE));
  const selectedOrder = orders.find((o) => o.id === selectedOrderId) ?? null;

  function closeDrawer() {
    setSelectedOrderId(null);
    if (searchParams.get('order')) {
      window.history.replaceState(null, '', '/dashboard/production');
    }
  }

  function toggleView(next: ProductionView) {
    setViewMode(next);
    void queryClient.invalidateQueries({ queryKey: ['production_orders'] });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Production Orders"
        description="Plan, run, and complete manufacturing against your bills of materials."
        actions={
          <>
            <Button variant="outline" onClick={() => setShowMachines(true)}>
              <Wrench className="h-4 w-4" />
              Machines
            </Button>
            <Button onClick={() => setShowPlanDialog(true)}>
              <Plus className="h-4 w-4" />
              Plan production
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        {viewMode === 'list' ? (
          <div className="flex flex-wrap gap-1.5">
            {(['ALL', ...PRODUCTION_STATUSES] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  statusFilter === status
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted'
                }`}
              >
                {status === 'ALL' ? 'All' : status.replace('_', ' ')}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Showing the {KANBAN_LIMIT} most recent orders across all statuses.
          </p>
        )}

        <div className="flex overflow-hidden rounded-md border border-border">
          <button
            type="button"
            onClick={() => toggleView('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium ${
              viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            List
          </button>
          <button
            type="button"
            onClick={() => toggleView('kanban')}
            className={`flex items-center gap-1.5 border-l border-border px-3 py-1.5 text-xs font-medium ${
              viewMode === 'kanban' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Kanban
          </button>
        </div>
      </div>

      {ordersQuery.isLoading ? (
        <DataTableSkeleton rows={6} cols={7} />
      ) : orders.length === 0 ? (
        <EmptyState
          title="No production orders yet"
          description="Plan a production run from an active bill of materials to get started."
          action={
            <Button onClick={() => setShowPlanDialog(true)}>
              <Plus className="h-4 w-4" />
              Plan first production order
            </Button>
          }
        />
      ) : viewMode === 'list' ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-border bg-muted text-xs font-medium uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Order #</th>
                  <th className="px-4 py-3">Finished good</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Target / Actual</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Machine</th>
                  <th className="px-4 py-3">Deadline</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="cursor-pointer border-b border-border/70 last:border-0 hover:bg-muted/40"
                    onClick={() => setSelectedOrderId(order.id)}
                  >
                    <td className="px-4 py-3 font-mono font-medium text-primary">{order.order_number}</td>
                    <td className="px-4 py-3 text-foreground">
                      {order.boms?.items?.standardized_name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status ?? 'PLANNED'} />
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {order.target_qty}
                      {order.actual_qty != null ? ` / ${order.actual_qty}` : ''}
                    </td>
                    <td className="px-4 py-3 text-foreground">{order.locations?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-foreground">{order.machines?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(order.deadline)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 ? (
            <div className="border-t border-border px-4 py-3">
              <Pagination page={page} totalPages={totalPages} onChange={setPage} />
            </div>
          ) : null}
        </div>
      ) : (
        <ProductionKanban orders={orders} onSelect={setSelectedOrderId} />
      )}

      <PlanProductionDialog open={showPlanDialog} onOpenChange={setShowPlanDialog} userId={userId} />
      <MachinesDrawer open={showMachines} onOpenChange={setShowMachines} userId={userId} />
      <ProductionDetailDrawer order={selectedOrder} onOpenChange={closeDrawer} userId={userId} />
    </div>
  );
}

function ProductionKanban({
  orders,
  onSelect,
}: {
  orders: ProductionOrderRow[];
  onSelect: (id: string) => void;
}) {
  const columns = PRODUCTION_STATUSES.map((status) => ({
    status,
    rows: orders.filter((o) => (o.status ?? 'PLANNED') === status),
  }));

  return (
    <div className="grid gap-4 overflow-x-auto pb-2 lg:grid-cols-6">
      {columns.map((col) => (
        <div key={col.status} className="min-w-[220px] rounded-xl border border-border bg-muted/30 p-3">
          <div className="mb-3 flex items-center justify-between">
            <StatusBadge status={col.status} />
            <span className="text-xs font-medium text-muted-foreground">{col.rows.length}</span>
          </div>
          <div className="space-y-2">
            {col.rows.map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => onSelect(order.id)}
                className="w-full rounded-lg border border-border bg-card p-3 text-left shadow-sm transition-shadow hover:shadow-md"
              >
                <p className="font-mono text-xs font-semibold text-primary">{order.order_number}</p>
                <p className="mt-1 truncate text-sm font-medium text-foreground">
                  {order.boms?.items?.standardized_name ?? '—'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {order.target_qty}
                  {order.actual_qty != null ? ` / ${order.actual_qty}` : ''} · {formatDate(order.deadline)}
                </p>
              </button>
            ))}
            {col.rows.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">No orders</p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
