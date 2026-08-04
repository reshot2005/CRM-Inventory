'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BookOpen, Download, Edit, Plus, Trash2, Upload } from 'lucide-react';
import { PageHeader, SearchToolbar, StatusBadge, CurrencyDisplay, EmptyState, Pagination } from '@/components/ui/enterprise';
import { DataTableSkeleton } from '@/components/ui/DataTableSkeleton';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { useUserId } from '@/lib/hooks/useUserId';
import { useOrgRole } from '@/lib/hooks/useOrgRole';
import { useRealtimeQuery } from '@/lib/hooks/useRealtimeQuery';
import { markNavPaint } from '@/lib/perf/nav-marks';
import { writeAuditLog } from '@/lib/audit/write-audit-log';
import { CsvImportDialog } from '@/components/csv/CsvImportDialog';
import {
  applyProductImport,
  downloadProductTemplate,
  exportProductCatalog,
  loadExistingItemsByCode,
  previewProductImport,
  type ProductImportRow,
} from '@/lib/csv/product-catalog';

const PAGE_SIZE = 20;
const CATEGORY_TABS = ['ALL', 'RAW_MATERIAL', 'FINISHED_GOOD', 'PACKAGING'] as const;
export type CategoryTab = (typeof CATEGORY_TABS)[number];

// ── Supabase row shapes ────────────────

interface LocationEmbed {
  name: string;
}

interface InventoryRow {
  quantity: number;
  reserved_qty: number;
  unit_cost: number;
  locations: LocationEmbed | null;
}

interface ItemRow {
  id: string;
  standardized_name: string;
  product_code: string;
  brand: string | null;
  category: string;
  packaging_type: string | null;
  min_stock_level: number;
  specifications: Record<string, unknown> | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  inventory: InventoryRow[];
}

interface StockLedgerRow {
  id: string;
  item_id: string;
  location_id: string;
  movement_type: string;
  quantity: number;
  balance_after: number;
  unit_cost: number | null;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_at: string;
}

interface DerivedItem extends ItemRow {
  total_stock: number;
  weighted_avg_cost: number;
  location_label: string;
}

export interface InventoryPageClientProps {
  defaultCategory?: CategoryTab;
  lockCategory?: boolean;
}

// ── Helpers ────────────────────────────

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

function statusFor(qty: number, min: number): string {
  if (qty <= 0) return 'OUT_OF_STOCK';
  if (qty <= min) return 'LOW_STOCK';
  return 'IN_STOCK';
}

function deriveItems(rawItems: ItemRow[]): DerivedItem[] {
  return rawItems.map((item) => {
    const totalStock = item.inventory.reduce((sum, inv) => sum + inv.quantity, 0);
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

    return {
      ...item,
      total_stock: totalStock,
      weighted_avg_cost: weightedAvgCost,
      location_label: uniqueLocations.join(', ') || '—',
    };
  });
}

function isLowStockItem(item: DerivedItem): boolean {
  const min = item.min_stock_level ?? 0;
  return min > 0 && item.total_stock <= min;
}

// ── Component ──────────────────────────

export default function InventoryPageClient({
  defaultCategory = 'ALL',
  lockCategory = false,
}: InventoryPageClientProps = {}) {
  const userId = useUserId();
  const { isAdmin } = useOrgRole();
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const filterLowStock = searchParams.get('filter') === 'lowstock';
  const pageFromUrl = Number.parseInt(searchParams.get('page') ?? '1', 10);
  const page = Number.isFinite(pageFromUrl) && pageFromUrl >= 1 ? pageFromUrl : 1;

  useEffect(() => {
    markNavPaint(pathname);
  }, [pathname]);

  const [search, setSearch] = useState('');
  const [typeTab, setTypeTab] = useState<CategoryTab>(defaultCategory);
  const [ledgerItemId, setLedgerItemId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const pendingImportRef = useRef<ProductImportRow[]>([]);
  const existingCodesRef = useRef<Map<string, { id: string }>>(new Map());

  const debouncedSearch = useDebounced(search, 300);
  const effectiveCategory = lockCategory ? defaultCategory : typeTab;

  const setPage = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (newPage <= 1) params.delete('page');
      else params.set('page', String(newPage));
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    if (!searchParams.has('page')) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [debouncedSearch, effectiveCategory, filterLowStock, pathname, router, searchParams]);

  const pageTitle = 'Products & SKUs';

  // ── Paginated items + nested inventory ──

  const { data: pageResult, isLoading } = useRealtimeQuery<{
    rows: DerivedItem[];
    total: number;
  }>(
    ['items', userId ?? '', effectiveCategory, debouncedSearch, page, filterLowStock ? 'lowstock' : 'all'],
    'items',
    async () => {
      if (!userId) return { rows: [], total: 0 };

      let lowStockIds: string[] | null = null;
      if (filterLowStock) {
        const { data: lowStockRows, error: rpcErr } = await supabase.rpc(
          'get_low_stock_items',
          { p_user_id: userId },
        );
        if (rpcErr) throw rpcErr;
        lowStockIds = Array.from(
          new Set((lowStockRows ?? []).map((row) => row.item_id)),
        );
        if (lowStockIds.length === 0) return { rows: [], total: 0 };
      }

      let q = supabase
        .from('items')
        .select(
          '*, inventory(quantity, reserved_qty, unit_cost, locations(name))',
          filterLowStock ? undefined : { count: 'exact' },
        )
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (effectiveCategory !== 'ALL') {
        q = q.eq('category', effectiveCategory);
      }
      if (debouncedSearch.trim()) {
        const s = debouncedSearch.trim();
        q = q.or(`standardized_name.ilike.%${s}%,product_code.ilike.%${s}%`);
      }
      if (filterLowStock && lowStockIds) {
        q = q.in('id', lowStockIds);
      }

      if (filterLowStock) {
        const { data, error } = await q.returns<ItemRow[]>();
        if (error) throw error;
        const derived = deriveItems(data ?? []).filter(isLowStockItem);
        const from = (page - 1) * PAGE_SIZE;
        return {
          rows: derived.slice(from, from + PAGE_SIZE),
          total: derived.length,
        };
      }

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error, count } = await q.range(from, to).returns<ItemRow[]>();
      if (error) throw error;
      return {
        rows: deriveItems(data ?? []),
        total: count ?? 0,
      };
    },
    !!userId,
  );

  const rows = pageResult?.rows ?? [];
  const totalCount = pageResult?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // ── Ledger drawer query (on-demand) ──

  const { data: ledgerRows } = useQuery({
    queryKey: ['stock_ledger', ledgerItemId, userId ?? ''],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_ledger')
        .select('*')
        .eq('user_id', userId!)
        .eq('item_id', ledgerItemId!)
        .order('created_at', { ascending: false })
        .limit(50)
        .returns<StockLedgerRow[]>();

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!ledgerItemId && !!userId,
  });

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
      void queryClient.invalidateQueries({ queryKey: ['items'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Render ───────────────────────────

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={pageTitle}
        description={`${totalCount} item${totalCount !== 1 ? 's' : ''} found${filterLowStock ? ' · low stock' : ''}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!userId || exporting}
              onClick={() => {
                if (!userId) return;
                setExporting(true);
                void exportProductCatalog(userId)
                  .then(() => toast.success('Catalog exported'))
                  .catch((e: Error) => toast.error(e.message || 'Export failed'))
                  .finally(() => setExporting(false));
              }}
            >
              <Download className="h-4 w-4" />
              {exporting ? 'Exporting…' : 'Export CSV'}
            </Button>
            {isAdmin ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  pendingImportRef.current = [];
                  setImportOpen(true);
                }}
              >
                <Upload className="h-4 w-4" />
                Import CSV
              </Button>
            ) : null}
            <Button asChild>
              <Link href="/dashboard/inventory/add">
                <Plus className="h-4 w-4" />
                Add Item
              </Link>
            </Button>
          </div>
        }
      />

      <CsvImportDialog
        open={importOpen}
        onOpenChange={(open) => {
          setImportOpen(open);
          if (open) {
            void loadExistingItemsByCode()
              .then((map) => {
                existingCodesRef.current = map;
              })
              .catch((e: Error) => toast.error(e.message));
          } else {
            pendingImportRef.current = [];
          }
        }}
        title="Import product catalog"
        description="Masters only — quantity stays 0. Qty columns in the file are ignored. Stock changes use Adjustments → count/opening import."
        templateHint="Upsert by product_code. Creates seed inventory at qty 0 for all active locations."
        onDownloadTemplate={downloadProductTemplate}
        confirming={importing}
        onParsed={(rows, headers) => {
          const result = previewProductImport(
            rows,
            headers,
            existingCodesRef.current,
          );
          pendingImportRef.current = result.valid;
          return {
            issues: result.issues,
            validCount: result.validCount,
            summary: result.summary,
          };
        }}
        onConfirm={async () => {
          if (!userId) return;
          const rows = pendingImportRef.current;
          if (!rows.length) return;
          setImporting(true);
          try {
            const { created, updated } = await applyProductImport(userId, rows);
            toast.success(
              `Imported catalog — ${created} created, ${updated} updated (qty unchanged)`,
            );
            setImportOpen(false);
            pendingImportRef.current = [];
            void queryClient.invalidateQueries({ queryKey: ['items'] });
            void queryClient.invalidateQueries({ queryKey: ['inventory'] });
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Import failed');
          } finally {
            setImporting(false);
          }
        }}
      />

      {/* Search + category tabs */}
      <SearchToolbar value={search} onChange={setSearch} placeholder="Search name or code…">
        {!lockCategory && (
          <div className="flex flex-wrap gap-2">
            {CATEGORY_TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeTab(t)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  typeTab === t
                    ? 'bg-primary text-white'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {t === 'ALL'
                  ? 'All'
                  : t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </button>
            ))}
          </div>
        )}
        {filterLowStock && (
          <StatusBadge status="LOW_STOCK" />
        )}
      </SearchToolbar>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="p-4">
            <DataTableSkeleton rows={5} cols={6} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title={filterLowStock ? 'No low-stock items' : 'No items yet'}
            description={
              filterLowStock
                ? 'All items are above their minimum stock levels.'
                : 'Add your first product to see it here.'
            }
            action={
              !filterLowStock ? (
                <Button asChild>
                  <Link href="/dashboard/inventory/add"><Plus className="h-4 w-4" />Add your first item</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b border-border bg-muted text-xs font-medium uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Image</th>
                  <th className="px-4 py-3">Name / Code</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Min</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Unit cost</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const status = statusFor(row.total_stock, row.min_stock_level);
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-border/70 last:border-0"
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
                        <p className="font-mono text-xs text-muted-foreground">
                          {row.product_code}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {row.category.replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {row.location_label}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {row.total_stock}
                      </td>
                      <td className="px-4 py-3">{row.min_stock_level}</td>
                      <td className="px-4 py-3"><StatusBadge status={status} /></td>
                      <td className="px-4 py-3 text-foreground">
                        <CurrencyDisplay value={row.weighted_avg_cost} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Link
                            href={`/dashboard/inventory/${row.id}/edit`}
                            className="text-primary hover:underline"
                            title="Edit"
                          ><Edit className="h-4 w-4" /></Link>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground"
                            title="Ledger"
                            onClick={() => setLedgerItemId(row.id)}
                          ><BookOpen className="h-4 w-4" /></button>
                          <button
                            type="button"
                            className="text-red-600 hover:underline"
                            title="Delete"
                            onClick={() => setConfirmId(row.id)}
                          ><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

      {/* Ledger drawer */}
      {ledgerItemId && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/30"
          role="presentation"
          onClick={() => setLedgerItemId(null)}
        >
          <div
            className="h-full w-full max-w-md overflow-y-auto bg-card p-6 shadow-xl"
            role="dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                Stock history
              </h2>
              <button
                type="button"
                onClick={() => setLedgerItemId(null)}
                className="text-muted-foreground"
              >
                ✕
              </button>
            </div>
            <ul className="space-y-3 text-sm">
              {(ledgerRows ?? []).map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-md border border-border p-3"
                >
                  <p className="font-medium text-foreground">
                    {entry.movement_type}{' '}
                    {entry.quantity > 0 ? '+' : ''}
                    {entry.quantity}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(entry.created_at).toLocaleString()} · Bal{' '}
                    {entry.balance_after}
                  </p>
                  {(entry.reference_type || entry.reference_id) && (
                    <p className="text-xs text-muted-foreground">
                      {[entry.reference_type, entry.reference_id]
                        .filter(Boolean)
                        .join(' ')}
                    </p>
                  )}
                </li>
              ))}
              {ledgerRows?.length === 0 && (
                <li className="py-8 text-center text-muted-foreground">
                  No ledger entries yet.
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Confirm deactivate dialog */}
      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-w-sm rounded-lg bg-card p-6 shadow-xl">
            <p className="text-foreground">Deactivate this item?</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmId(null)}
                className="rounded-md border border-border px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void deleteMutation.mutateAsync(confirmId);
                  setConfirmId(null);
                }}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white"
              >
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

