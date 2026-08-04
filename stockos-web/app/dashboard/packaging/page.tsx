'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PackagePlus, Trash2, LayoutGrid, List } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useUserId } from '@/lib/hooks/useUserId';
import { useRealtimeQuery } from '@/lib/hooks/useRealtimeQuery';
import {
  getStockStatus,
  getStockStatusColor,
} from '@/lib/utils/format';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CurrencyDisplay, EmptyState, PageHeader, Pagination, SearchToolbar, StatusBadge } from '@/components/ui/enterprise';
import { writeAuditLog } from '@/lib/audit/write-audit-log';

const PAGE_SIZE = 20;
const VIEW_STORAGE_KEY = 'stockos-packaging-view';

type PackagingView = 'table' | 'cards';

// ── Row shapes ──────────────────────────────────

interface LocationEmbed {
  name: string;
}

interface InventoryRow {
  quantity: number;
  reserved_qty: number;
  unit_cost: number;
  locations: LocationEmbed | null;
}

interface VendorEmbed {
  id: string;
  company_name: string;
}

interface VendorItemRow {
  unit_price: number | null;
  lead_time_days: number | null;
  is_preferred: boolean;
  vendors: VendorEmbed | null;
}

interface PackagingRow {
  id: string;
  user_id: string;
  standardized_name: string;
  product_code: string;
  brand: string | null;
  category: string;
  packaging_type: string | null;
  packaging_size: string | null;
  min_stock_level: number;
  specifications: Record<string, unknown> | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  inventory: InventoryRow[];
  vendor_items: VendorItemRow[];
}

interface DerivedItem extends PackagingRow {
  total_stock: number;
  weighted_avg_cost: number;
  location_label: string;
  preferred_vendor: VendorEmbed | null;
  vendor_price: number | null;
}

// ── Helpers ─────────────────────────────────────

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

function generatePONumber(): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = (now.getMonth() + 1).toString().padStart(2, '0');
  const d = now.getDate().toString().padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PO-${y}${m}${d}-${rand}`;
}

function stockProgressPct(qty: number, minLevel: number): number {
  if (minLevel <= 0) return qty > 0 ? 100 : 0;
  return Math.min(100, (qty / minLevel) * 100);
}

function stockProgressBarColor(status: 'OUT' | 'LOW' | 'OK'): string {
  return {
    OUT: 'bg-red-500',
    LOW: 'bg-amber-500',
    OK: 'bg-emerald-500',
  }[status];
}

// ── Component ───────────────────────────────────

export default function PackagingPage() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [view, setView] = useState<PackagingView>('table');

  useEffect(() => {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === 'table' || stored === 'cards') {
      setView(stored);
    }
  }, []);

  const setViewMode = (next: PackagingView) => {
    setView(next);
    localStorage.setItem(VIEW_STORAGE_KEY, next);
  };

  const debouncedSearch = useDebounced(search, 300);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // ── Fetch packaging items + inventory + vendor_items ──

  const { data: rawItems, isLoading } = useRealtimeQuery<PackagingRow[]>(
    ['packaging-materials', userId ?? ''],
    'items',
    async () => {
      const { data, error } = await supabase
        .from('items')
        .select(
          '*, inventory(quantity, reserved_qty, unit_cost, locations(name)), vendor_items(unit_price, lead_time_days, is_preferred, vendors(id, company_name))',
        )
        .eq('user_id', userId!)
        .eq('is_active', true)
        .eq('category', 'PACKAGING')
        .order('created_at', { ascending: false })
        .returns<PackagingRow[]>();

      if (error) throw error;
      return data ?? [];
    },
    !!userId,
  );

  // ── Derive totals + preferred vendor ──

  const derivedItems = useMemo<DerivedItem[]>(() => {
    if (!rawItems) return [];
    return rawItems.map((item) => {
      const totalStock = item.inventory.reduce(
        (sum, inv) => sum + inv.quantity,
        0,
      );
      const totalValue = item.inventory.reduce(
        (sum, inv) => sum + inv.quantity * inv.unit_cost,
        0,
      );
      const weightedAvgCost = totalStock > 0 ? totalValue / totalStock : 0;

      const uniqueLocations = Array.from(
        new Set(
          item.inventory
            .map((inv) => inv.locations?.name)
            .filter((n): n is string => Boolean(n)),
        ),
      );

      const preferred = item.vendor_items.find((vi) => vi.is_preferred);

      return {
        ...item,
        total_stock: totalStock,
        weighted_avg_cost: weightedAvgCost,
        location_label: uniqueLocations.join(', ') || '—',
        preferred_vendor: preferred?.vendors ?? null,
        vendor_price: preferred?.unit_price ?? null,
      };
    });
  }, [rawItems]);

  // ── Items needing reorder ──

  const reorderItems = useMemo(
    () => derivedItems.filter((d) => d.total_stock <= d.min_stock_level && d.min_stock_level > 0),
    [derivedItems],
  );

  // ── Client-side search ──

  const filtered = useMemo(() => {
    if (!debouncedSearch) return derivedItems;
    const q = debouncedSearch.toLowerCase();
    return derivedItems.filter(
      (r) =>
        r.standardized_name.toLowerCase().includes(q) ||
        r.product_code.toLowerCase().includes(q) ||
        (r.packaging_type ?? '').toLowerCase().includes(q),
    );
  }, [derivedItems, debouncedSearch]);

  // ── Pagination ──

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  // ── Soft-delete mutation ──

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('items')
        .update({ is_active: false })
        .eq('id', id)
        .eq('user_id', userId);
      if (error) throw error;

      await writeAuditLog({
        userId,
        action: 'DELETE',
        entityType: 'item',
        entityId: id,
        oldValues: { is_active: true },
        newValues: { is_active: false },
      });
    },
    onSuccess: () => {
      toast.success('Item deactivated');
      void queryClient.invalidateQueries({ queryKey: ['packaging-materials'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Quick PO mutation ──

  const quickPOMutation = useMutation({
    mutationFn: async (item: DerivedItem) => {
      if (!userId) throw new Error('Not authenticated');
      if (!item.preferred_vendor) throw new Error('No preferred vendor set for this item');

      const reorderQty = Math.max(1, item.min_stock_level - item.total_stock);
      const unitPrice = item.vendor_price ?? item.weighted_avg_cost;
      const poNumber = generatePONumber();

      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
          user_id: userId,
          po_number: poNumber,
          vendor_id: item.preferred_vendor.id,
          status: 'DRAFT',
          total_amount: reorderQty * unitPrice,
          notes: `Auto-reorder for ${item.standardized_name} (packaging)`,
        })
        .select('id')
        .single();

      if (poError) throw poError;

      const { error: lineError } = await supabase
        .from('purchase_order_lines')
        .insert({
          user_id: userId,
          purchase_order_id: po.id,
          item_id: item.id,
          ordered_qty: reorderQty,
          unit_price: unitPrice,
        });

      if (lineError) throw lineError;

      await writeAuditLog({
        userId,
        action: 'CREATE',
        entityType: 'purchase_order',
        entityId: po.id,
        newValues: {
          po_number: poNumber,
          vendor_id: item.preferred_vendor.id,
          status: 'DRAFT',
          source: 'packaging_quick_po',
          item_id: item.id,
        },
      });

      return poNumber;
    },
    onSuccess: (poNumber: string) => {
      toast.success(`Draft PO ${poNumber} created`);
      void queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Render ────────────────────────────────────

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Packaging Materials"
        description={`${filtered.length} item${filtered.length !== 1 ? 's' : ''} found`}
      />

      {/* Auto-reorder alert section */}
      {reorderItems.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-xs text-white">
              {reorderItems.length}
            </span>
            Packaging Items Needing Restock
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {reorderItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-md border border-amber-200 bg-white px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {item.standardized_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Stock: {item.total_stock} / Min: {item.min_stock_level}
                    {item.preferred_vendor
                      ? ` · ${item.preferred_vendor.company_name}`
                      : ''}
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={!item.preferred_vendor || quickPOMutation.isPending}
                  onClick={() => quickPOMutation.mutate(item)}
                  className="ml-2 shrink-0"
                  title={
                    item.preferred_vendor
                      ? `Create draft PO from ${item.preferred_vendor.company_name}`
                      : 'No preferred vendor set'
                  }
                >
                  <PackagePlus className="h-3.5 w-3.5" />
                  Quick PO
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <SearchToolbar value={search} onChange={setSearch} placeholder="Search name, code, or packaging type…">
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-border bg-muted p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                view === 'table'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                view === 'cards'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Cards
            </button>
          </div>
          <StatusBadge status="PACKAGING" />
        </div>
      </SearchToolbar>

      {/* Table or Cards */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded bg-muted"
              />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title="No packaging materials found" description='Add items with category "Packaging" to see them here.' />
        ) : view === 'cards' ? (
          <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((row) => {
              const stockStatus = getStockStatus(row.total_stock, row.min_stock_level);
              const progressPct = stockProgressPct(row.total_stock, row.min_stock_level);

              return (
                <div
                  key={row.id}
                  className="flex flex-col rounded-lg border border-border bg-card p-4 shadow-sm"
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">
                        {row.standardized_name}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {row.product_code}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${getStockStatusColor(stockStatus)}`}
                    >
                      {stockStatus}
                    </span>
                  </div>

                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>Stock</span>
                    <span className="tabular-nums">
                      {row.total_stock} / {row.min_stock_level || '—'}
                    </span>
                  </div>
                  <div className="mb-4 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all ${stockProgressBarColor(stockStatus)}`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>

                  <div className="mt-auto flex gap-2">
                    <Button
                      size="sm"
                      disabled={!row.preferred_vendor || quickPOMutation.isPending}
                      onClick={() => quickPOMutation.mutate(row)}
                      title="Create draft PO"
                      className="flex-1"
                    >
                      <PackagePlus className="h-3.5 w-3.5" />
                      Quick PO
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      title="Deactivate"
                      onClick={() => setConfirmId(row.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="border-b border-border bg-muted text-xs font-medium uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Image</th>
                  <th className="px-4 py-3">Name / Code</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Min</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Unit Cost</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-4 py-3">
                        <div className="h-10 w-10 overflow-hidden rounded bg-muted">
                          {row.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={row.image_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">
                          {row.standardized_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {row.product_code}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {row.packaging_type ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {row.packaging_size ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {row.location_label}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {row.total_stock}
                      </td>
                      <td className="px-4 py-3">{row.min_stock_level}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.total_stock <= 0 ? 'OUT_OF_STOCK' : row.total_stock <= row.min_stock_level ? 'LOW_STOCK' : 'IN_STOCK'} />
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        <CurrencyDisplay value={row.weighted_avg_cost} />
                      </td>
                      <td className="px-4 py-3">
                        {row.preferred_vendor ? (
                          <div>
                            <p className="text-sm text-foreground">
                              {row.preferred_vendor.company_name}
                            </p>
                            {row.vendor_price !== null && (
                              <p className="text-xs text-muted-foreground">
                                <CurrencyDisplay value={row.vendor_price} />
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled={!row.preferred_vendor || quickPOMutation.isPending}
                            onClick={() => quickPOMutation.mutate(row)}
                            title="Create draft PO"
                          >
                            <PackagePlus className="h-3.5 w-3.5" />
                            Quick PO
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            title="Deactivate"
                            onClick={() => setConfirmId(row.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pagination */}
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

      <Dialog open={!!confirmId} onOpenChange={(open) => !open && setConfirmId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Deactivate packaging item?</DialogTitle>
            <DialogDescription>This item will be hidden from active lists but its data is preserved.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { if (confirmId) void deleteMutation.mutateAsync(confirmId); setConfirmId(null); }}>Deactivate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
