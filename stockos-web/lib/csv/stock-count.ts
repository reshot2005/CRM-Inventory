import { createClient } from '@/lib/supabase/client';
import { downloadCSV } from '@/lib/csv/download';
import { getCell } from '@/lib/csv/parse';
import type { CsvPreviewIssue } from '@/components/csv/CsvImportDialog';
import { applyStockAdjustment } from '@/lib/stock/movements';
import { writeAuditLog } from '@/lib/audit/write-audit-log';

export const COUNT_SHEET_HEADERS = [
  'location_code',
  'product_code',
  'item_name',
  'unit',
  'system_qty',
  'counted_qty',
  'notes',
] as const;

export const OPENING_HEADERS = [
  'location_code',
  'product_code',
  'opening_qty',
  'notes',
] as const;

export interface CountImportRow {
  rowNumber: number;
  item_id: string;
  location_id: string;
  product_code: string;
  location_code: string;
  delta: number;
  notes: string | null;
}

export interface OpeningImportRow {
  rowNumber: number;
  item_id: string;
  location_id: string;
  product_code: string;
  location_code: string;
  opening_qty: number;
  notes: string | null;
}

type LocRow = { id: string; code: string; name: string };
type ItemRow = { id: string; product_code: string; standardized_name: string; unit: string | null };

export async function exportCountSheet(locationId?: string | null): Promise<void> {
  const supabase = createClient();

  let locQuery = supabase
    .from('locations')
    .select('id, code, name')
    .eq('is_active', true)
    .order('code');
  if (locationId) locQuery = locQuery.eq('id', locationId);
  const { data: locations, error: locErr } = await locQuery;
  if (locErr) throw new Error(locErr.message);
  if (!locations?.length) throw new Error('No active locations');

  const locIds = locations.map((l) => l.id);

  const { data: invRows, error: invErr } = await supabase
    .from('inventory')
    .select(
      'quantity, location_id, item_id, items(product_code, standardized_name, unit, is_active), locations(code)',
    )
    .in('location_id', locIds);

  if (invErr) throw new Error(invErr.message);

  const rows: string[][] = [];
  for (const inv of invRows ?? []) {
    const item = inv.items as unknown as {
      product_code: string;
      standardized_name: string;
      unit: string | null;
      is_active: boolean | null;
    } | null;
    if (!item || item.is_active === false) continue;
    const loc = inv.locations as unknown as { code: string } | null;
    rows.push([
      loc?.code ?? '',
      item.product_code ?? '',
      item.standardized_name ?? '',
      item.unit ?? 'pcs',
      String(Number(inv.quantity ?? 0)),
      '',
      '',
    ]);
  }

  rows.sort((a, b) =>
    `${a[0]}|${a[1]}`.localeCompare(`${b[0]}|${b[1]}`, undefined, {
      sensitivity: 'base',
    }),
  );

  const suffix = locationId
    ? locations[0]?.code ?? 'location'
    : 'all-locations';
  downloadCSV(`count-sheet-${suffix}.csv`, [...COUNT_SHEET_HEADERS], rows);
}

export function downloadOpeningTemplate(): void {
  downloadCSV('opening-balances-template.csv', [...OPENING_HEADERS], [
    ['WH-001', 'RAW-001', '100', 'Opening balance import'],
  ]);
}

export function downloadCountTemplate(): void {
  downloadCSV('count-sheet-template.csv', [...COUNT_SHEET_HEADERS], [
    ['WH-001', 'RAW-001', 'Example Item', 'pcs', '0', '', ''],
  ]);
}

async function loadLookups(): Promise<{
  locationsByCode: Map<string, LocRow>;
  itemsByCode: Map<string, ItemRow>;
  qtyByKey: Map<string, number>;
}> {
  const supabase = createClient();
  const [{ data: locations, error: locErr }, { data: items, error: itemErr }, { data: inv, error: invErr }] =
    await Promise.all([
      supabase.from('locations').select('id, code, name').eq('is_active', true),
      supabase
        .from('items')
        .select('id, product_code, standardized_name, unit')
        .eq('is_active', true),
      supabase.from('inventory').select('item_id, location_id, quantity'),
    ]);

  if (locErr) throw new Error(locErr.message);
  if (itemErr) throw new Error(itemErr.message);
  if (invErr) throw new Error(invErr.message);

  const locationsByCode = new Map<string, LocRow>();
  for (const l of locations ?? []) {
    locationsByCode.set(l.code.toLowerCase(), l as LocRow);
  }
  const itemsByCode = new Map<string, ItemRow>();
  for (const i of items ?? []) {
    itemsByCode.set(i.product_code.toLowerCase(), i as ItemRow);
  }
  const qtyByKey = new Map<string, number>();
  for (const row of inv ?? []) {
    qtyByKey.set(
      `${row.item_id}|${row.location_id}`,
      Number(row.quantity ?? 0),
    );
  }

  return { locationsByCode, itemsByCode, qtyByKey };
}

export type StockCsvLookups = Awaited<ReturnType<typeof loadLookups>>;

export async function loadStockCsvLookups(): Promise<StockCsvLookups> {
  return loadLookups();
}

export function previewCountImport(
  rawRows: Record<string, string>[],
  lookups: StockCsvLookups,
): {
  issues: CsvPreviewIssue[];
  valid: CountImportRow[];
  validCount: number;
  summary: string;
} {
  const issues: CsvPreviewIssue[] = [];
  const valid: CountImportRow[] = [];
  const seen = new Set<string>();

  rawRows.forEach((row, idx) => {
    const rowNumber = idx + 2;
    const location_code = getCell(row, 'location_code').trim();
    const product_code = getCell(row, 'product_code').trim();
    const countedRaw = getCell(row, 'counted_qty').trim();
    const notes = getCell(row, 'notes').trim() || null;

    if (!location_code || !product_code) {
      issues.push({
        row: rowNumber,
        level: 'error',
        message: 'location_code and product_code are required',
      });
      return;
    }
    if (countedRaw === '') {
      issues.push({
        row: rowNumber,
        level: 'warning',
        message: 'counted_qty blank — skipped',
      });
      return;
    }
    const counted_qty = Number(countedRaw);
    if (!Number.isFinite(counted_qty) || counted_qty < 0) {
      issues.push({
        row: rowNumber,
        level: 'error',
        message: 'counted_qty must be a number ≥ 0',
      });
      return;
    }

    const loc = lookups.locationsByCode.get(location_code.toLowerCase());
    const item = lookups.itemsByCode.get(product_code.toLowerCase());
    if (!loc) {
      issues.push({
        row: rowNumber,
        level: 'error',
        message: `Unknown location_code ${location_code}`,
      });
      return;
    }
    if (!item) {
      issues.push({
        row: rowNumber,
        level: 'error',
        message: `Unknown product_code ${product_code}`,
      });
      return;
    }

    const key = `${item.id}|${loc.id}`;
    if (seen.has(key)) {
      issues.push({
        row: rowNumber,
        level: 'error',
        message: `Duplicate ${location_code}/${product_code} in file`,
      });
      return;
    }
    seen.add(key);

    const current = lookups.qtyByKey.get(key) ?? 0;
    const delta = counted_qty - current;
    if (delta === 0) {
      issues.push({
        row: rowNumber,
        level: 'warning',
        message: `No variance for ${product_code} @ ${location_code} — skipped`,
      });
      return;
    }

    valid.push({
      rowNumber,
      item_id: item.id,
      location_id: loc.id,
      product_code,
      location_code,
      delta,
      notes,
    });
  });

  const errors = issues.filter((i) => i.level === 'error').length;
  return {
    issues,
    valid,
    validCount: errors > 0 ? 0 : valid.length,
    summary: `${valid.length} PENDING correction(s) will be created (zeros skipped). Stock changes only after manager Apply.`,
  };
}

export function previewOpeningImport(
  rawRows: Record<string, string>[],
  lookups: StockCsvLookups,
): {
  issues: CsvPreviewIssue[];
  valid: OpeningImportRow[];
  validCount: number;
  summary: string;
} {
  const issues: CsvPreviewIssue[] = [];
  const valid: OpeningImportRow[] = [];
  const seen = new Set<string>();

  rawRows.forEach((row, idx) => {
    const rowNumber = idx + 2;
    const location_code = getCell(row, 'location_code').trim();
    const product_code = getCell(row, 'product_code').trim();
    const qtyRaw = getCell(row, 'opening_qty').trim();
    const notes =
      getCell(row, 'notes').trim() || 'Opening balance import';

    if (!location_code || !product_code) {
      issues.push({
        row: rowNumber,
        level: 'error',
        message: 'location_code and product_code are required',
      });
      return;
    }
    const opening_qty = Number(qtyRaw);
    if (!Number.isFinite(opening_qty) || opening_qty <= 0) {
      issues.push({
        row: rowNumber,
        level: 'warning',
        message: 'opening_qty ≤ 0 — skipped',
      });
      return;
    }

    const loc = lookups.locationsByCode.get(location_code.toLowerCase());
    const item = lookups.itemsByCode.get(product_code.toLowerCase());
    if (!loc) {
      issues.push({
        row: rowNumber,
        level: 'error',
        message: `Unknown location_code ${location_code}`,
      });
      return;
    }
    if (!item) {
      issues.push({
        row: rowNumber,
        level: 'error',
        message: `Unknown product_code ${product_code}`,
      });
      return;
    }

    const key = `${item.id}|${loc.id}`;
    if (seen.has(key)) {
      issues.push({
        row: rowNumber,
        level: 'error',
        message: `Duplicate ${location_code}/${product_code} in file`,
      });
      return;
    }
    seen.add(key);

    valid.push({
      rowNumber,
      item_id: item.id,
      location_id: loc.id,
      product_code,
      location_code,
      opening_qty,
      notes,
    });
  });

  const errors = issues.filter((i) => i.level === 'error').length;
  return {
    issues,
    valid,
    validCount: errors > 0 ? 0 : valid.length,
    summary: `${valid.length} PENDING opening ADD adjustment(s). Apply separately to move stock.`,
  };
}

const CHUNK = 200;

export async function applyCountImport(
  userId: string,
  rows: CountImportRow[],
  applyAfter: boolean,
): Promise<{ created: number; applied: number }> {
  const supabase = createClient();
  const payload = rows.map((r) => ({
    user_id: userId,
    item_id: r.item_id,
    location_id: r.location_id,
    quantity: r.delta,
    adjustment_type: 'CORRECT' as const,
    reason: 'COUNT_CORRECTION' as const,
    notes: r.notes,
    status: 'PENDING' as const,
    approved_by: null,
    approved_at: null,
    created_by: userId,
  }));

  const ids: string[] = [];
  for (let i = 0; i < payload.length; i += CHUNK) {
    const chunk = payload.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from('stock_adjustments')
      .insert(chunk)
      .select('id');
    if (error) throw new Error(error.message);
    for (const row of data ?? []) ids.push(row.id);
  }

  await writeAuditLog({
    userId,
    action: 'CREATE',
    entityType: 'stock_adjustment',
    entityId: ids[0] ?? null,
    newValues: {
      source: 'count_sheet_import',
      count: ids.length,
    },
  });

  let applied = 0;
  if (applyAfter) {
    for (const id of ids) {
      await applyStockAdjustment(userId, id);
      applied++;
    }
  }

  return { created: ids.length, applied };
}

export async function applyOpeningImport(
  userId: string,
  rows: OpeningImportRow[],
  applyAfter: boolean,
): Promise<{ created: number; applied: number }> {
  const supabase = createClient();

  // Ensure inventory rows exist (qty 0) before ADD adjustments
  for (const r of rows) {
    const keyQty = `${r.item_id}|${r.location_id}`;
    void keyQty;
    const { data: existing } = await supabase
      .from('inventory')
      .select('id')
      .eq('item_id', r.item_id)
      .eq('location_id', r.location_id)
      .maybeSingle();
    if (!existing) {
      await supabase.from('inventory').insert({
        user_id: userId,
        item_id: r.item_id,
        location_id: r.location_id,
        quantity: 0,
        reserved_qty: 0,
        unit_cost: 0,
      });
    }
  }

  const payload = rows.map((r) => ({
    user_id: userId,
    item_id: r.item_id,
    location_id: r.location_id,
    quantity: r.opening_qty,
    adjustment_type: 'ADD' as const,
    reason: 'OTHER' as const,
    notes: r.notes,
    status: 'PENDING' as const,
    approved_by: null,
    approved_at: null,
    created_by: userId,
  }));

  const ids: string[] = [];
  for (let i = 0; i < payload.length; i += CHUNK) {
    const chunk = payload.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from('stock_adjustments')
      .insert(chunk)
      .select('id');
    if (error) throw new Error(error.message);
    for (const row of data ?? []) ids.push(row.id);
  }

  await writeAuditLog({
    userId,
    action: 'CREATE',
    entityType: 'stock_adjustment',
    entityId: ids[0] ?? null,
    newValues: {
      source: 'opening_balance_import',
      count: ids.length,
    },
  });

  let applied = 0;
  if (applyAfter) {
    for (const id of ids) {
      await applyStockAdjustment(userId, id);
      applied++;
    }
  }

  return { created: ids.length, applied };
}
