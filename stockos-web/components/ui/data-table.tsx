import type { ReactNode } from 'react';
import { ArrowDownUp } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { EmptyState } from '@/components/ui/enterprise';
import { Button } from '@/components/ui/button';

export interface DataColumn<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  sortable?: boolean;
}

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  isLoading,
  emptyTitle = 'No records found',
  emptyDescription,
  onSort,
}: {
  rows: T[];
  columns: DataColumn<T>[];
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onSort?: (key: string) => void;
}) {
  if (isLoading) {
    return <div className="space-y-3 rounded-xl border border-border bg-card p-5">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-10 animate-pulse rounded bg-muted" />)}</div>;
  }
  if (!rows.length) return <EmptyState title={emptyTitle} description={emptyDescription} />;
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-muted/60 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>{columns.map((column) => <th key={column.key} scope="col" className={cn('px-5 py-3.5', column.className)}>{column.sortable && onSort ? <Button variant="ghost" size="sm" className="-ml-2 h-auto px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground" onClick={() => onSort(column.key)}>{column.header}<ArrowDownUp className="h-3 w-3" /></Button> : column.header}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-border/70">{rows.map((row) => <tr key={row.id} className="transition-colors hover:bg-muted/40">{columns.map((column) => <td key={column.key} className={cn('px-5 py-3.5 text-foreground', column.className)}>{column.cell(row)}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
