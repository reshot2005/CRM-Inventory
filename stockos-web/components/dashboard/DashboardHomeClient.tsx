'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { useDashboardKPIs } from '@/lib/hooks/useDashboardKPIs';
import { useLowStockAlerts } from '@/lib/hooks/useLowStockAlerts';
import { useRealtimeQuery } from '@/lib/hooks/useRealtimeQuery';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency, getStockStatus, getStockStatusColor } from '@/lib/utils/format';
import { DataTableSkeleton } from '@/components/ui/DataTableSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { markNavPaint } from '@/lib/perf/nav-marks';

const IN_TYPES = new Set([
  'IN',
  'ADJUSTMENT_IN',
  'TRANSFER_IN',
  'PRODUCTION_IN',
  'PURCHASE_RECEIVE',
  'RETURN_IN',
]);

interface LedgerRow {
  id: string;
  movement_type: string;
  quantity: number;
  created_at: string;
  items: { standardized_name: string; product_code: string } | null;
  locations: { name: string } | null;
}

interface ProductRow {
  id: string;
  standardized_name: string;
  product_code: string;
  min_stock_level: number;
  inventory: Array<{
    quantity: number;
    locations: { name: string } | null;
  }>;
}

function StatCard({
  title,
  value,
  href,
  loading,
  accent,
}: {
  title: string;
  value: string | number;
  href?: string;
  loading: boolean;
  accent?: string;
}) {
  const inner = (
    <div
      className="rounded-lg border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_4px_rgba(30,42,74,0.07)]"
      style={{ borderTopWidth: accent ? 3 : 1, borderTopColor: accent }}
    >
      <p className="text-sm text-[#64748B]">{title}</p>
      {loading ? (
        <div className="mt-2 h-8 w-24 animate-pulse rounded bg-[#E2E8F0]" />
      ) : (
        <p className="mt-1 text-2xl font-semibold text-[#0F172A]">{value}</p>
      )}
    </div>
  );
  if (href && !loading) {
    return (
      <Link href={href} className="block transition hover:opacity-90">
        {inner}
      </Link>
    );
  }
  return inner;
}

function AiChatWidget({ userId }: { userId: string | null }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<
    Array<{ role: 'user' | 'assistant'; text: string }>
  >([
    {
      role: 'assistant',
      text: 'I can help with stock levels, low stock alerts, and purchase orders. What would you like to know?',
    },
  ]);
  const [busy, setBusy] = useState(false);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (!q || !userId || busy) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setBusy(true);
    try {
      const supabase = createClient();
      const lower = q.toLowerCase();
      let reply =
        'I can help with stock levels, low stock alerts, and purchase orders. What would you like to know?';

      if (lower.includes('low stock') || lower.includes('low-stock')) {
        const { data, error } = await supabase.rpc('get_low_stock_items', {
          p_user_id: userId,
        });
        if (error) throw error;
        const rows = data ?? [];
        if (rows.length === 0) {
          reply = 'No low stock items right now. All SKUs are above minimum levels.';
        } else {
          const top = rows
            .slice(0, 5)
            .map(
              (r) =>
                `• ${r.item_name} (${r.product_code}): ${Number(r.current_qty).toFixed(2)} at ${r.location_name} (min ${r.min_stock_level})`,
            )
            .join('\n');
          reply = `Found ${rows.length} low stock item(s):\n${top}`;
        }
      } else if (lower.includes('purchase') || lower.includes('po')) {
        const { count, error } = await supabase
          .from('purchase_orders')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .not('status', 'in', '("CANCELLED","RECEIVED")');
        if (error) throw error;
        reply = `You have ${count ?? 0} open purchase order(s).`;
      }

      setMessages((m) => [...m, { role: 'assistant', text: reply }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          text: err instanceof Error ? err.message : 'Something went wrong.',
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_4px_rgba(30,42,74,0.07)]">
      <h2 className="mb-3 text-lg font-medium text-[#0F172A]">
        Keyword helper
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          (not a real AI assistant)
        </span>
      </h2>
      <div className="mb-3 max-h-48 space-y-2 overflow-y-auto text-sm">
        {messages.map((msg, i) => (
          <p
            key={i}
            className={
              msg.role === 'user'
                ? 'rounded-md bg-[#EFF6FF] px-3 py-2 text-[#1E40AF] whitespace-pre-wrap'
                : 'rounded-md bg-[#F8FAFC] px-3 py-2 text-[#334155] whitespace-pre-wrap'
            }
          >
            {msg.text}
          </p>
        ))}
      </div>
      <form onSubmit={handleSend} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about low stock or purchase orders…"
          className="flex-1 rounded-md border border-[#E2E8F0] px-3 py-2 text-sm outline-none focus:border-[#1E90FF]"
        />
        <button
          type="submit"
          disabled={busy || !userId}
          className="rounded-md bg-[#1E90FF] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </section>
  );
}

export function DashboardHomeClient() {
  const { userId, loading: userLoading } = useCurrentUser();
  const queryClient = useQueryClient();
  const kpisQuery = useDashboardKPIs(userId);
  const lowStockQuery = useLowStockAlerts(userId);

  useEffect(() => {
    markNavPaint('/dashboard');
  }, []);

  // Realtime: invalidate KPIs when inventory / sale_orders change
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`dashboard-kpis-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory' },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
          void queryClient.invalidateQueries({ queryKey: ['low-stock'] });
          void queryClient.invalidateQueries({ queryKey: ['dashboard-products'] });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sale_orders' },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'stock_ledger' },
        () => {
          void queryClient.invalidateQueries({
            queryKey: ['dashboard-ledger'],
          });
        },
      )
      .subscribe();

    const poll = setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
    }, 30_000);

    return () => {
      void supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [userId, queryClient]);

  const ledgerQuery = useRealtimeQuery<LedgerRow[]>(
    ['dashboard-ledger', userId ?? ''],
    'stock_ledger',
    async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('stock_ledger')
        .select(
          'id, movement_type, quantity, created_at, items(standardized_name, product_code), locations(name)',
        )
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as unknown as LedgerRow[];
    },
    !!userId,
  );

  const productsQuery = useQuery({
    queryKey: ['dashboard-products', userId ?? ''],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('items')
        .select(
          'id, standardized_name, product_code, min_stock_level, inventory(quantity, locations(name))',
        )
        .eq('user_id', userId!)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as unknown as ProductRow[];
    },
    enabled: !!userId,
    staleTime: 30_000,
  });

  const kpis = kpisQuery.data;
  const lowStock = lowStockQuery.data ?? [];
  const loading = userLoading || kpisQuery.isLoading;

  const lowStockNames = useMemo(
    () => lowStock.slice(0, 3).map((r) => r.item_name).join(', '),
    [lowStock],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-[#0F172A]">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-[#64748B]">
          Live factory overview from Supabase
        </p>
      </div>

      {lowStock.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>{lowStock.length} low stock item(s)</strong>
          {lowStockNames ? ` — ${lowStockNames}` : null}
          {lowStock.length > 3 ? ` and ${lowStock.length - 3} more` : null}.{' '}
          <Link
            href="/dashboard/products?filter=lowstock"
            className="font-medium underline underline-offset-2"
          >
            View products
          </Link>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Active SKUs"
          value={kpis?.total_skus ?? 0}
          href="/dashboard/products"
          loading={loading}
          accent="#1E90FF"
        />
        <StatCard
          title="Low stock"
          value={kpis?.low_stock_items ?? 0}
          href="/dashboard/products?filter=lowstock"
          loading={loading}
          accent="#F59E0B"
        />
        <StatCard
          title="Open POs"
          value={kpis?.open_purchase_orders ?? 0}
          href="/dashboard/purchase-orders"
          loading={loading}
          accent="#10B981"
        />
        <StatCard
          title="Pending deliveries"
          value={kpis?.pending_deliveries ?? 0}
          href="/dashboard/sales"
          loading={loading}
          accent="#8B5CF6"
        />
      </div>

      {!loading && kpis && (kpis.revenue_mtd ?? 0) > 0 ? (
        <p className="text-sm text-[#94A3B8]">
          Revenue MTD:{' '}
          <span className="font-medium text-[#0F172A]">
            {formatCurrency(kpis.revenue_mtd)}
          </span>
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_4px_rgba(30,42,74,0.07)]">
          <h2 className="mb-4 text-lg font-medium text-[#0F172A]">
            Recent stock movements
          </h2>
          {ledgerQuery.isLoading ? (
            <DataTableSkeleton rows={5} cols={3} />
          ) : (ledgerQuery.data ?? []).length === 0 ? (
            <EmptyState
              icon="📦"
              title="No movements yet"
              description="Stock ledger entries will appear here after receives, dispatches, and adjustments."
            />
          ) : (
            <ul className="space-y-3">
              {(ledgerQuery.data ?? []).map((row) => {
                const isIn = IN_TYPES.has(row.movement_type);
                return (
                  <li
                    key={row.id}
                    className="flex gap-3 border-b border-[#F1F5F9] pb-3 text-sm last:border-0"
                  >
                    <span
                      className={`mt-0.5 rounded px-1.5 py-0.5 text-xs font-medium ${
                        isIn
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {isIn ? 'IN' : 'OUT'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[#0F172A]">
                        {row.items?.standardized_name ?? 'Item'}{' '}
                        <span className="font-mono text-xs font-normal text-[#94A3B8]">
                          {row.items?.product_code}
                        </span>
                      </p>
                      <p className="text-[#64748B]">
                        {Number(row.quantity).toFixed(2)} ·{' '}
                        {row.locations?.name ?? '—'} ·{' '}
                        {formatDistanceToNow(new Date(row.created_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_4px_rgba(30,42,74,0.07)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium text-[#0F172A]">Products & SKUs</h2>
            <Link
              href="/dashboard/products"
              className="text-sm font-medium text-[#1E90FF] hover:underline"
            >
              View all
            </Link>
          </div>
          {productsQuery.isLoading ? (
            <DataTableSkeleton rows={5} cols={4} />
          ) : (productsQuery.data ?? []).length === 0 ? (
            <EmptyState
              icon="🏷️"
              title="No products yet"
              description="Add your first SKU to start tracking inventory."
              action={
                <Link
                  href="/dashboard/inventory/add"
                  className="rounded-md bg-[#1E90FF] px-3 py-2 text-sm font-medium text-white"
                >
                  Add product
                </Link>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-[#94A3B8]">
                  <tr>
                    <th className="pb-2">Product</th>
                    <th className="pb-2">Code</th>
                    <th className="pb-2 text-right">Qty</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(productsQuery.data ?? []).map((item) => {
                    const qty = item.inventory.reduce(
                      (s, inv) => s + Number(inv.quantity),
                      0,
                    );
                    const status = getStockStatus(qty, item.min_stock_level);
                    return (
                      <tr key={item.id} className="border-t border-[#F1F5F9]">
                        <td className="py-2 font-medium text-[#0F172A]">
                          {item.standardized_name}
                        </td>
                        <td className="py-2 font-mono text-xs text-[#64748B]">
                          {item.product_code}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {qty.toFixed(2)}
                        </td>
                        <td className="py-2">
                          <span
                            className={`rounded px-1.5 py-0.5 text-xs font-medium ${getStockStatusColor(status)}`}
                          >
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <AiChatWidget userId={userId} />
    </div>
  );
}
