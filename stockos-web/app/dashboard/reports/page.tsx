'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState, useCallback } from 'react';
import { format, subDays } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import { useUserId } from '@/lib/hooks/useUserId';
import { useRealtimeQuery } from '@/lib/hooks/useRealtimeQuery';
import { EmptyState, PageHeader, StatusBadge } from '@/components/ui/enterprise';
import { DataTableSkeleton } from '@/components/ui/DataTableSkeleton';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';
import { downloadCSV } from '@/lib/csv/download';

const MovementChart = dynamic(() => import('@/components/reports/MovementChart'), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 items-end gap-3 px-8">
      {[40, 65, 80, 50, 70, 35].map((h, i) => (
        <div key={i} className="flex-1 animate-pulse rounded-t bg-muted" style={{ height: `${h}%` }} />
      ))}
    </div>
  ),
});

/* ═══════════════════════════ Types ═══════════════════════════ */

interface ValuationItemEmbed {
  id: string;
  standardized_name: string;
  product_code: string;
  inventory: { quantity: number; unit_cost: number }[];
}

interface ValuationRow {
  id: string;
  name: string;
  code: string;
  totalQty: number;
  avgCost: number;
  totalValue: number;
}

interface SaleOrderJoin {
  id: string;
  order_number: string;
  created_at: string;
  total_amount: number;
  payment_status: string;
  status: string;
  customers: { company_name: string | null; primary_contact: string } | null;
}

interface SaleRow {
  id: string;
  orderNumber: string;
  date: string;
  customerName: string;
  totalAmount: number;
  paymentStatus: string;
  orderStatus: string;
}

interface PurchaseOrderJoin {
  id: string;
  po_number: string;
  created_at: string;
  total_amount: number;
  status: string;
  vendors: { company_name: string } | null;
}

interface PurchaseRow {
  id: string;
  poNumber: string;
  date: string;
  vendorName: string;
  totalAmount: number;
  status: string;
}

interface LedgerEntry {
  movement_type: string;
  quantity: number;
  created_at: string;
}

interface MovementPoint {
  date: string;
  label: string;
  in: number;
  out: number;
}

interface LowStockRow {
  id: string;
  name: string;
  code: string;
  locationName: string;
  currentQty: number;
  minLevel: number;
  deficit: number;
}

/* ═══════════════════════════ Constants ═══════════════════════ */

type ReportTab = 'valuation' | 'sales' | 'purchases' | 'movement' | 'low-stock';

const TABS: { key: ReportTab; label: string }[] = [
  { key: 'valuation', label: 'Stock Valuation' },
  { key: 'sales', label: 'Sales Register' },
  { key: 'purchases', label: 'Purchase Register' },
  { key: 'movement', label: 'Stock Movement' },
  { key: 'low-stock', label: 'Low Stock' },
];

const IN_TYPES = new Set([
  'IN',
  'TRANSFER_IN',
  'PRODUCTION_IN',
  'PURCHASE_RECEIVE',
  'RETURN_IN',
  'ADJUSTMENT_IN',
]);
const OUT_TYPES = new Set([
  'OUT',
  'TRANSFER_OUT',
  'PRODUCTION_OUT',
  'SALE_DISPATCH',
  'RETURN_OUT',
  'ADJUSTMENT_OUT',
]);

/* ═══════════════════════════ UI Atoms ════════════════════════ */

function ExportButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick} disabled={disabled}><Download className="h-4 w-4" />Export CSV</Button>
  );
}

/* ═══════════════════════════ Page ════════════════════════════ */

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('valuation');
  const userId = useUserId();
  const supabase = useMemo(() => createClient(), []);
  const enabled = !!userId;

  const thirtyDaysAgo = useMemo(
    () => subDays(new Date(), 30).toISOString(),
    [],
  );

  /* ── 1 · Stock Valuation ─────────────────────────────────── */

  const { data: valuationData, isLoading: valuationLoading } =
    useRealtimeQuery<ValuationRow[]>(
      ['reports', 'valuation', userId ?? ''],
      'inventory',
      async () => {
        const { data, error } = await supabase
          .from('items')
          .select(
            'id, standardized_name, product_code, inventory(quantity, unit_cost)',
          )
          .eq('user_id', userId!)
          .eq('is_active', true)
          .order('standardized_name', { ascending: true })
          .returns<ValuationItemEmbed[]>();

        if (error) throw error;

        return (data ?? []).map((item) => {
          const totalQty = item.inventory.reduce(
            (s, inv) => s + inv.quantity,
            0,
          );
          const totalValue = item.inventory.reduce(
            (s, inv) => s + inv.quantity * inv.unit_cost,
            0,
          );
          return {
            id: item.id,
            name: item.standardized_name,
            code: item.product_code,
            totalQty,
            avgCost: totalQty > 0 ? totalValue / totalQty : 0,
            totalValue,
          };
        });
      },
      enabled && activeTab === 'valuation',
    );

  const valuationGrandTotal = useMemo(
    () => (valuationData ?? []).reduce((s, r) => s + r.totalValue, 0),
    [valuationData],
  );

  /* ── 2 · Sales Register (30 days) ───────────────────────── */

  const { data: salesData, isLoading: salesLoading } =
    useRealtimeQuery<SaleRow[]>(
      ['reports', 'sales', userId ?? ''],
      'sale_orders',
      async () => {
        const { data, error } = await supabase
          .from('sale_orders')
          .select(
            'id, order_number, created_at, total_amount, payment_status, status, customers(company_name, primary_contact)',
          )
          .eq('user_id', userId!)
          .gte('created_at', thirtyDaysAgo)
          .order('created_at', { ascending: false })
          .returns<SaleOrderJoin[]>();

        if (error) throw error;

        return (data ?? []).map((row) => ({
          id: row.id,
          orderNumber: row.order_number,
          date: row.created_at,
          customerName:
            row.customers?.company_name ||
            row.customers?.primary_contact ||
            '—',
          totalAmount: row.total_amount,
          paymentStatus: row.payment_status,
          orderStatus: row.status,
        }));
      },
      enabled && activeTab === 'sales',
    );

  /* ── 3 · Purchase Register (30 days) ────────────────────── */

  const { data: purchasesData, isLoading: purchasesLoading } =
    useRealtimeQuery<PurchaseRow[]>(
      ['reports', 'purchases', userId ?? ''],
      'purchase_orders',
      async () => {
        const { data, error } = await supabase
          .from('purchase_orders')
          .select(
            'id, po_number, created_at, total_amount, status, vendors(company_name)',
          )
          .eq('user_id', userId!)
          .gte('created_at', thirtyDaysAgo)
          .order('created_at', { ascending: false })
          .returns<PurchaseOrderJoin[]>();

        if (error) throw error;

        return (data ?? []).map((row) => ({
          id: row.id,
          poNumber: row.po_number,
          date: row.created_at,
          vendorName: row.vendors?.company_name ?? '—',
          totalAmount: row.total_amount,
          status: row.status,
        }));
      },
      enabled && activeTab === 'purchases',
    );

  /* ── 4 · Stock Movement Trend (30 days line chart) ──────── */

  const { data: movementData, isLoading: movementLoading } =
    useRealtimeQuery<MovementPoint[]>(
      ['reports', 'movement', userId ?? ''],
      'stock_ledger',
      async () => {
        const { data, error } = await supabase
          .from('stock_ledger')
          .select('movement_type, quantity, created_at')
          .eq('user_id', userId!)
          .gte('created_at', thirtyDaysAgo)
          .order('created_at', { ascending: true })
          .returns<LedgerEntry[]>();

        if (error) throw error;

        const dateMap = new Map<string, { in: number; out: number }>();
        for (let i = 29; i >= 0; i--) {
          dateMap.set(format(subDays(new Date(), i), 'yyyy-MM-dd'), {
            in: 0,
            out: 0,
          });
        }

        for (const row of data ?? []) {
          const key = format(new Date(row.created_at), 'yyyy-MM-dd');
          const bucket = dateMap.get(key);
          if (!bucket) continue;
          if (IN_TYPES.has(row.movement_type))
            bucket.in += Math.abs(row.quantity);
          else if (OUT_TYPES.has(row.movement_type))
            bucket.out += Math.abs(row.quantity);
        }

        return Array.from(dateMap.entries()).map(([d, v]) => ({
          date: d,
          label: format(new Date(d), 'dd MMM'),
          in: Math.round(v.in),
          out: Math.round(v.out),
        }));
      },
      enabled && activeTab === 'movement',
    );

  /* ── 5 · Low Stock Report ───────────────────────────────── */

  const { data: lowStockData, isLoading: lowStockLoading } =
    useRealtimeQuery<LowStockRow[]>(
      ['reports', 'low-stock', userId ?? ''],
      'inventory',
      async () => {
        const { data, error } = await supabase.rpc('get_low_stock_items', {
          p_user_id: userId!,
        });
        if (error) throw error;

        return (data ?? []).map((row) => ({
          id: `${row.item_id}-${row.location_id}`,
          name: row.item_name,
          code: row.product_code,
          locationName: row.location_name,
          currentQty: Number(row.current_qty),
          minLevel: Number(row.min_stock_level),
          deficit: Number(row.deficit),
        }));
      },
      enabled && activeTab === 'low-stock',
    );

  /* ── CSV Exports ────────────────────────────────────────── */

  const exportValuation = useCallback(() => {
    if (!valuationData) return;
    downloadCSV(
      'stock-valuation.csv',
      ['Item Name', 'Code', 'Total Qty', 'Avg Unit Cost (₹)', 'Total Value (₹)'],
      valuationData.map((r) => [
        r.name,
        r.code,
        String(r.totalQty),
        formatCurrency(r.avgCost),
        formatCurrency(r.totalValue),
      ]),
    );
  }, [valuationData]);

  const exportSales = useCallback(() => {
    if (!salesData) return;
    downloadCSV(
      'sales-register-30d.csv',
      ['Order #', 'Date', 'Customer', 'Total (₹)', 'Payment Status', 'Order Status'],
      salesData.map((r) => [
        r.orderNumber,
        format(new Date(r.date), 'dd MMM yyyy'),
        r.customerName,
        formatCurrency(r.totalAmount),
        r.paymentStatus,
        r.orderStatus,
      ]),
    );
  }, [salesData]);

  const exportPurchases = useCallback(() => {
    if (!purchasesData) return;
    downloadCSV(
      'purchase-register-30d.csv',
      ['PO #', 'Date', 'Vendor', 'Total (₹)', 'Status'],
      purchasesData.map((r) => [
        r.poNumber,
        format(new Date(r.date), 'dd MMM yyyy'),
        r.vendorName,
        formatCurrency(r.totalAmount),
        r.status,
      ]),
    );
  }, [purchasesData]);

  const exportMovement = useCallback(() => {
    if (!movementData) return;
    downloadCSV(
      'stock-movement-30d.csv',
      ['Date', 'Stock In', 'Stock Out'],
      movementData.map((r) => [r.label, String(r.in), String(r.out)]),
    );
  }, [movementData]);

  const exportLowStock = useCallback(() => {
    if (!lowStockData) return;
    downloadCSV(
      'low-stock-report.csv',
      ['Item Name', 'Code', 'Location', 'Current Qty', 'Min Level', 'Deficit'],
      lowStockData.map((r) => [
        r.name,
        r.code,
        r.locationName,
        String(r.currentQty),
        String(r.minLevel),
        String(r.deficit),
      ]),
    );
  }, [lowStockData]);

  /* ── Render ─────────────────────────────────────────────── */

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Reports" description="Live reporting across inventory, sales, and purchases." actions={<>
        {/* Export button for active tab */}
        {activeTab === 'valuation' && (
          <ExportButton onClick={exportValuation} disabled={valuationLoading || !valuationData?.length} />
        )}
        {activeTab === 'sales' && (
          <ExportButton onClick={exportSales} disabled={salesLoading || !salesData?.length} />
        )}
        {activeTab === 'purchases' && (
          <ExportButton onClick={exportPurchases} disabled={purchasesLoading || !purchasesData?.length} />
        )}
        {activeTab === 'movement' && (
          <ExportButton onClick={exportMovement} disabled={movementLoading || !movementData?.length} />
        )}
        {activeTab === 'low-stock' && (
          <ExportButton onClick={exportLowStock} disabled={lowStockLoading || !lowStockData?.length} />
        )}
      </>} />

      {/* Tab navigation */}
      <div className="flex flex-wrap gap-2 rounded-lg border border-[#E2E8F0] bg-white p-2 shadow-sm">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === tab.key
                ? 'bg-[#1E90FF] text-white shadow-sm'
                : 'text-[#64748B] hover:bg-[#F1F5F9]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ━━━━━ Tab content ━━━━━ */}

      {/* 1 · Stock Valuation */}
      {activeTab === 'valuation' && (
        <section className="overflow-hidden rounded-lg border border-[#E2E8F0] bg-white shadow-[0_1px_4px_rgba(30,42,74,0.07)]">
          {valuationLoading ? (
            <div className="p-4"><DataTableSkeleton rows={6} cols={5} /></div>
          ) : !valuationData?.length ? (
            <EmptyState title="No inventory data" description="No active items with inventory found." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-medium uppercase text-[#64748B]">
                  <tr>
                    <th className="px-4 py-3">Item Name</th>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3 text-right">Total Qty</th>
                    <th className="px-4 py-3 text-right">Avg Unit Cost</th>
                    <th className="px-4 py-3 text-right">Total Value</th>
                  </tr>
                </thead>
                <tbody>
                  {valuationData.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-[#F1F5F9] last:border-0"
                    >
                      <td className="px-4 py-3 font-medium text-[#0F172A]">
                        {row.name}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{row.code}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        {row.totalQty.toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-right text-[#334155]">
                        {formatCurrency(row.avgCost)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-[#0F172A]">
                        {formatCurrency(row.totalValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-[#E2E8F0] bg-[#F8FAFC]">
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-3 text-right text-sm font-semibold text-[#0F172A]"
                    >
                      Grand Total
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-[#0F172A]">
                      {formatCurrency(valuationGrandTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      )}

      {/* 2 · Sales Register */}
      {activeTab === 'sales' && (
        <section className="overflow-hidden rounded-lg border border-[#E2E8F0] bg-white shadow-[0_1px_4px_rgba(30,42,74,0.07)]">
          <div className="border-b border-[#E2E8F0] px-4 py-3">
            <p className="text-xs text-[#94A3B8]">
              Showing orders from the last 30 days
              {salesData ? ` · ${salesData.length} order${salesData.length !== 1 ? 's' : ''}` : ''}
            </p>
          </div>
          {salesLoading ? (
            <div className="p-4"><DataTableSkeleton rows={6} cols={6} /></div>
          ) : !salesData?.length ? (
            <EmptyState title="No sales data" description="No sale orders in the last 30 days." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-medium uppercase text-[#64748B]">
                  <tr>
                    <th className="px-4 py-3">Order #</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {salesData.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-[#F1F5F9] last:border-0"
                    >
                      <td className="px-4 py-3 font-mono text-xs font-medium text-[#0F172A]">
                        {row.orderNumber}
                      </td>
                      <td className="px-4 py-3 text-[#64748B]">
                        {format(new Date(row.date), 'dd MMM yyyy')}
                      </td>
                      <td className="px-4 py-3 text-[#334155]">
                        {row.customerName}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-[#0F172A]">
                        {formatCurrency(row.totalAmount)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.paymentStatus} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.orderStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* 3 · Purchase Register */}
      {activeTab === 'purchases' && (
        <section className="overflow-hidden rounded-lg border border-[#E2E8F0] bg-white shadow-[0_1px_4px_rgba(30,42,74,0.07)]">
          <div className="border-b border-[#E2E8F0] px-4 py-3">
            <p className="text-xs text-[#94A3B8]">
              Showing POs from the last 30 days
              {purchasesData
                ? ` · ${purchasesData.length} order${purchasesData.length !== 1 ? 's' : ''}`
                : ''}
            </p>
          </div>
          {purchasesLoading ? (
            <div className="p-4"><DataTableSkeleton rows={6} cols={5} /></div>
          ) : !purchasesData?.length ? (
            <EmptyState title="No purchase data" description="No purchase orders in the last 30 days." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-medium uppercase text-[#64748B]">
                  <tr>
                    <th className="px-4 py-3">PO #</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Vendor</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {purchasesData.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-[#F1F5F9] last:border-0"
                    >
                      <td className="px-4 py-3 font-mono text-xs font-medium text-[#0F172A]">
                        {row.poNumber}
                      </td>
                      <td className="px-4 py-3 text-[#64748B]">
                        {format(new Date(row.date), 'dd MMM yyyy')}
                      </td>
                      <td className="px-4 py-3 text-[#334155]">
                        {row.vendorName}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-[#0F172A]">
                        {formatCurrency(row.totalAmount)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* 4 · Stock Movement Trend (Line Chart) */}
      {activeTab === 'movement' && (
        <section className="rounded-lg border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_4px_rgba(30,42,74,0.07)]">
          <h2 className="mb-1 text-lg font-medium text-[#0F172A]">
            Daily Stock In / Out — Last 30 Days
          </h2>
          <p className="mb-4 text-xs text-[#94A3B8]">
            Green = stock received · Red = stock dispatched
          </p>

          {movementLoading ? (
            <div className="flex h-64 items-end gap-3 px-8">
              {[40, 65, 80, 50, 70, 35].map((h, i) => (
                <div key={i} className="flex-1 animate-pulse rounded-t bg-muted" style={{ height: `${h}%` }} />
              ))}
            </div>
          ) : !movementData?.length ? (
            <EmptyState title="No movement data" description="No stock movements in the last 30 days." />
          ) : (
            <MovementChart data={movementData} />
          )}
        </section>
      )}

      {/* 5 · Low Stock Report */}
      {activeTab === 'low-stock' && (
        <section className="overflow-hidden rounded-lg border border-[#E2E8F0] bg-white shadow-[0_1px_4px_rgba(30,42,74,0.07)]">
          <div className="border-b border-[#E2E8F0] px-4 py-3">
            <p className="text-xs text-[#94A3B8]">
              Items at or below minimum stock level
              {lowStockData
                ? ` · ${lowStockData.length} item${lowStockData.length !== 1 ? 's' : ''}`
                : ''}
            </p>
          </div>
          {lowStockLoading ? (
            <div className="p-4"><DataTableSkeleton rows={6} cols={6} /></div>
          ) : !lowStockData?.length ? (
            <EmptyState title="Stock levels OK" description="All items are above their minimum stock levels." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-medium uppercase text-[#64748B]">
                  <tr>
                    <th className="px-4 py-3">Item Name</th>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3 text-right">Current Qty</th>
                    <th className="px-4 py-3 text-right">Min Level</th>
                    <th className="px-4 py-3 text-right">Deficit</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockData.map((row) => {
                    const critical = row.currentQty <= 0;
                    return (
                      <tr
                        key={row.id}
                        className={`border-b border-[#F1F5F9] last:border-0 ${critical ? 'bg-red-50' : ''}`}
                      >
                        <td className="px-4 py-3 font-medium text-[#0F172A]">
                          {row.name}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {row.code}
                        </td>
                        <td className="px-4 py-3 text-[#334155]">
                          {row.locationName}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-medium ${critical ? 'text-red-600' : 'text-amber-600'}`}
                        >
                          {row.currentQty.toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3 text-right text-[#334155]">
                          {row.minLevel.toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-red-600">
                          {row.deficit.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
