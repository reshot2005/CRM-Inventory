export const INR_FORMATTER = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(amount: number | null | undefined): string {
  return INR_FORMATTER.format(amount ?? 0);
}

/** @deprecated Use formatCurrency */
export function formatINR(value: number | null | undefined): string {
  return formatCurrency(value);
}

export function formatQty(qty: number, unit = 'pcs'): string {
  return `${Number(qty).toFixed(2)} ${unit}`;
}

export function formatCompactNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat('en-IN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value ?? 0);
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function getStockStatus(
  qty: number,
  minLevel: number,
): 'OUT' | 'LOW' | 'OK' {
  if (qty <= 0) return 'OUT';
  if (qty <= minLevel) return 'LOW';
  return 'OK';
}

export function getStockStatusColor(status: 'OUT' | 'LOW' | 'OK'): string {
  return {
    OUT: 'bg-red-100 text-red-700',
    LOW: 'bg-amber-100 text-amber-700',
    OK: 'bg-green-100 text-green-700',
  }[status];
}
