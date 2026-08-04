import { createClient } from '@/lib/supabase/client';
import { downloadCSV } from '@/lib/csv/download';
import { getCell } from '@/lib/csv/parse';
import type { CsvPreviewIssue } from '@/components/csv/CsvImportDialog';
import { writeAuditLog } from '@/lib/audit/write-audit-log';

export const PRODUCT_MASTER_HEADERS = [
  'product_code',
  'standardized_name',
  'category',
  'brand',
  'unit',
  'packaging_type',
  'packaging_size',
  'min_stock_level',
  'is_active',
] as const;

const CATEGORIES = new Set([
  'RAW_MATERIAL',
  'FINISHED_GOOD',
  'PACKAGING',
  'OTHER',
]);

const PACKAGING_TYPES = new Set([
  'BOX',
  'PACKETS',
  'BAGS',
  'ROLL',
  'SHEET',
  'SACKS',
  'OTHERS',
]);

const CODE_RE = /^[A-Za-z0-9._-]+$/;

export type ProductImportAction = 'create' | 'update';

export interface ProductImportRow {
  rowNumber: number;
  action: ProductImportAction;
  existingId?: string;
  product_code: string;
  standardized_name: string;
  category: string;
  brand: string | null;
  unit: string;
  packaging_type: string | null;
  packaging_size: string | null;
  min_stock_level: number;
  is_active: boolean;
}

function isQtyHeader(h: string): boolean {
  return /^qty[:_]/i.test(h) || h.toLowerCase() === 'quantity';
}

export function downloadProductTemplate(): void {
  downloadCSV('product-catalog-template.csv', [...PRODUCT_MASTER_HEADERS], [
    [
      'RAW-001',
      'Example Raw Material',
      'RAW_MATERIAL',
      '',
      'pcs',
      '',
      '',
      '10',
      'true',
    ],
  ]);
}

export async function exportProductCatalog(userId: string): Promise<void> {
  const supabase = createClient();
  const { data: items, error } = await supabase
    .from('items')
    .select(
      'product_code, standardized_name, category, brand, unit, packaging_type, packaging_size, min_stock_level, is_active, inventory(quantity, locations(code))',
    )
    .order('product_code');

  if (error) throw new Error(error.message);

  const { data: locations } = await supabase
    .from('locations')
    .select('code')
    .eq('is_active', true)
    .order('code');

  const locCodes = (locations ?? [])
    .map((l) => l.code)
    .filter(Boolean) as string[];

  const headers = [
    ...PRODUCT_MASTER_HEADERS,
    ...locCodes.map((c) => `qty:${c}`),
  ];

  type InvEmbed = {
    quantity: number;
    locations: { code: string } | null;
  };

  const rows = (items ?? []).map((item) => {
    const inv = (item.inventory ?? []) as unknown as InvEmbed[];
    const qtyByCode = new Map<string, number>();
    for (const row of inv) {
      const code = row.locations?.code;
      if (!code) continue;
      qtyByCode.set(code, (qtyByCode.get(code) ?? 0) + Number(row.quantity ?? 0));
    }
    return [
      item.product_code ?? '',
      item.standardized_name ?? '',
      item.category ?? '',
      item.brand ?? '',
      item.unit ?? 'pcs',
      item.packaging_type ?? '',
      item.packaging_size ?? '',
      String(item.min_stock_level ?? 0),
      item.is_active === false ? 'false' : 'true',
      ...locCodes.map((c) => String(qtyByCode.get(c) ?? 0)),
    ];
  });

  void userId;
  downloadCSV('product-catalog-export.csv', headers, rows);
}

export function previewProductImport(
  rawRows: Record<string, string>[],
  headers: string[],
  existingByCode: Map<string, { id: string }>,
): { issues: CsvPreviewIssue[]; valid: ProductImportRow[]; validCount: number; summary: string } {
  const issues: CsvPreviewIssue[] = [];
  const valid: ProductImportRow[] = [];
  const seen = new Set<string>();

  const qtyHeaders = headers.filter(isQtyHeader);
  if (qtyHeaders.length > 0) {
    issues.push({
      row: 0,
      level: 'warning',
      message: `Qty columns ignored on catalog import (${qtyHeaders.join(', ')}). Use count/opening import for stock.`,
    });
  }

  rawRows.forEach((row, idx) => {
    const rowNumber = idx + 2;
    const product_code = getCell(row, 'product_code').trim();
    const standardized_name = getCell(row, 'standardized_name').trim();
    const category = getCell(row, 'category').trim().toUpperCase();
    const brand = getCell(row, 'brand').trim() || null;
    const unit = getCell(row, 'unit').trim() || 'pcs';
    const packaging_typeRaw = getCell(row, 'packaging_type').trim();
    const packaging_size = getCell(row, 'packaging_size').trim() || null;
    const minRaw = getCell(row, 'min_stock_level').trim();
    const activeRaw = getCell(row, 'is_active').trim().toLowerCase();

    if (!product_code) {
      issues.push({ row: rowNumber, level: 'error', message: 'product_code is required' });
      return;
    }
    if (!CODE_RE.test(product_code)) {
      issues.push({
        row: rowNumber,
        level: 'error',
        message: 'product_code has invalid characters',
      });
      return;
    }
    if (seen.has(product_code.toLowerCase())) {
      issues.push({
        row: rowNumber,
        level: 'error',
        message: `Duplicate product_code in file: ${product_code}`,
      });
      return;
    }
    seen.add(product_code.toLowerCase());

    if (!standardized_name) {
      issues.push({
        row: rowNumber,
        level: 'error',
        message: 'standardized_name is required',
      });
      return;
    }
    if (!CATEGORIES.has(category)) {
      issues.push({
        row: rowNumber,
        level: 'error',
        message: `Invalid category "${category}"`,
      });
      return;
    }

    let packaging_type: string | null = packaging_typeRaw || null;
    if (packaging_type && !PACKAGING_TYPES.has(packaging_type)) {
      issues.push({
        row: rowNumber,
        level: 'warning',
        message: `Unknown packaging_type "${packaging_type}" — will be cleared`,
      });
      packaging_type = null;
    }

    const min_stock_level = minRaw === '' ? 0 : Number(minRaw);
    if (!Number.isFinite(min_stock_level) || min_stock_level < 0) {
      issues.push({
        row: rowNumber,
        level: 'error',
        message: 'min_stock_level must be a number ≥ 0',
      });
      return;
    }

    const is_active =
      activeRaw === '' ||
      activeRaw === 'true' ||
      activeRaw === '1' ||
      activeRaw === 'yes';

    const existing = existingByCode.get(product_code.toLowerCase());
    valid.push({
      rowNumber,
      action: existing ? 'update' : 'create',
      existingId: existing?.id,
      product_code,
      standardized_name,
      category,
      brand,
      unit,
      packaging_type,
      packaging_size,
      min_stock_level,
      is_active,
    });
  });

  const creates = valid.filter((v) => v.action === 'create').length;
  const updates = valid.filter((v) => v.action === 'update').length;
  const errors = issues.filter((i) => i.level === 'error').length;

  return {
    issues,
    valid,
    validCount: errors > 0 ? 0 : valid.length,
    summary: `${valid.length} row(s) ready (${creates} create, ${updates} update). Qty columns never change stock.`,
  };
}

export async function applyProductImport(
  userId: string,
  rows: ProductImportRow[],
): Promise<{ created: number; updated: number }> {
  const supabase = createClient();
  const { data: locations, error: locErr } = await supabase
    .from('locations')
    .select('id')
    .eq('is_active', true);
  if (locErr) throw new Error(locErr.message);
  const locs = locations ?? [];

  let created = 0;
  let updated = 0;

  for (const row of rows) {
    if (row.action === 'create') {
      const { data: newItem, error } = await supabase
        .from('items')
        .insert({
          user_id: userId,
          product_code: row.product_code,
          standardized_name: row.standardized_name,
          category: row.category,
          brand: row.brand,
          unit: row.unit,
          packaging_type: row.packaging_type,
          packaging_size: row.packaging_size,
          min_stock_level: row.min_stock_level,
          is_active: row.is_active,
        })
        .select('id')
        .single();
      if (error) throw new Error(`Row ${row.rowNumber}: ${error.message}`);

      if (locs.length > 0) {
        const { error: invErr } = await supabase.from('inventory').insert(
          locs.map((loc) => ({
            user_id: userId,
            location_id: loc.id,
            item_id: newItem.id,
            quantity: 0,
            reserved_qty: 0,
            unit_cost: 0,
          })),
        );
        if (invErr) {
          console.error('Inventory seed failed:', invErr.message);
        }
      }

      await writeAuditLog({
        userId,
        action: 'CREATE',
        entityType: 'item',
        entityId: newItem.id,
        newValues: {
          product_code: row.product_code,
          standardized_name: row.standardized_name,
          category: row.category,
          source: 'csv_import',
        },
      });
      created++;
    } else if (row.existingId) {
      const { error } = await supabase
        .from('items')
        .update({
          standardized_name: row.standardized_name,
          category: row.category,
          brand: row.brand,
          unit: row.unit,
          packaging_type: row.packaging_type,
          packaging_size: row.packaging_size,
          min_stock_level: row.min_stock_level,
          is_active: row.is_active,
        })
        .eq('id', row.existingId);
      if (error) throw new Error(`Row ${row.rowNumber}: ${error.message}`);

      await writeAuditLog({
        userId,
        action: 'UPDATE',
        entityType: 'item',
        entityId: row.existingId,
        newValues: {
          product_code: row.product_code,
          standardized_name: row.standardized_name,
          source: 'csv_import',
        },
      });
      updated++;
    }
  }

  return { created, updated };
}

export async function loadExistingItemsByCode(): Promise<
  Map<string, { id: string }>
> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('items')
    .select('id, product_code');
  if (error) throw new Error(error.message);
  const map = new Map<string, { id: string }>();
  for (const item of data ?? []) {
    map.set(item.product_code.toLowerCase(), { id: item.id });
  }
  return map;
}
