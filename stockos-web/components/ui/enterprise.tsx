'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Inbox, Search, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getStatusMeta } from '@/lib/constants/statuses';
import { formatINR } from '@/lib/utils/format';

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const meta = getStatusMeta(status);
  return <Badge variant={meta.tone}>{meta.label}</Badge>;
}

export function CurrencyDisplay({ value, className }: { value: number | null | undefined; className?: string }) {
  return <span className={className}>{formatINR(value)}</span>;
}

export function StatCard({ label, value, icon: Icon, trend, accent = 'primary' }: { label: string; value: string | number; icon?: LucideIcon; trend?: string; accent?: 'primary' | 'success' | 'warning' | 'danger' }) {
  const color = { primary: 'bg-primary/10 text-primary', success: 'bg-emerald-500/10 text-emerald-600', warning: 'bg-amber-500/10 text-amber-600', danger: 'bg-destructive/10 text-destructive' }[accent];
  return (
    <Card className="p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 font-heading text-2xl font-bold tabular-nums">{value}</p>
          {trend ? <p className="mt-1 text-xs text-muted-foreground">{trend}</p> : null}
        </div>
        {Icon ? <div className={`rounded-lg p-2.5 ${color}`}><Icon className="h-5 w-5" aria-hidden="true" /></div> : null}
      </div>
    </Card>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-8 text-center">
      <div className="mb-4 rounded-full bg-muted p-3"><Inbox className="h-6 w-6 text-muted-foreground" aria-hidden="true" /></div>
      <h3 className="font-heading font-semibold">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function SearchToolbar({ value, onChange, placeholder = 'Search records…', children }: { value: string; onChange: (value: string) => void; placeholder?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input value={value} onChange={(event) => onChange(event.target.value)} className="pl-9" placeholder={placeholder} />
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft className="h-4 w-4" /> Previous</Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next <ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

export function Breadcrumbs({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav aria-label="Breadcrumb" className="hidden items-center gap-1 text-xs text-muted-foreground md:flex">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="flex items-center gap-1">
          {index ? <span aria-hidden="true">/</span> : null}
          {item.href ? <Link href={item.href} className="hover:text-foreground">{item.label}</Link> : <span className="text-foreground">{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}
