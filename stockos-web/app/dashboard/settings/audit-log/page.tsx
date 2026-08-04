'use client';

import { Fragment, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useOrgRole } from '@/lib/hooks/useOrgRole';
import { PageHeader, StatusBadge, EmptyState } from '@/components/ui/enterprise';
import { Button } from '@/components/ui/button';
import { DataTableSkeleton } from '@/components/ui/DataTableSkeleton';
import { formatDateTime } from '@/lib/utils/format';
import type { Json } from '@/lib/supabase/database.types';

const PAGE_SIZE = 25;

const ACTIONS = [
  'ALL',
  'CREATE',
  'UPDATE',
  'DELETE',
  'APPROVE',
  'REJECT',
  'LOGIN',
  'LOGOUT',
] as const;

type AuditRow = {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: Json | null;
  new_values: Json | null;
  created_at: string | null;
  profiles: { full_name: string | null } | null;
};

function prettyJson(value: Json | null): string {
  if (value == null) return '—';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function AuditLogPage() {
  const supabase = useMemo(() => createClient(), []);
  const { orgId, isAdmin, loading: roleLoading } = useOrgRole();

  const [page, setPage] = useState(1);
  const [action, setAction] = useState<(typeof ACTIONS)[number]>('ALL');
  const [entityType, setEntityType] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const query = useQuery({
    queryKey: [
      'audit-logs',
      orgId ?? '',
      page,
      action,
      entityType,
      userFilter,
      fromDate,
      toDate,
    ],
    enabled: Boolean(orgId) && isAdmin,
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let q = supabase
        .from('audit_logs')
        .select(
          'id, user_id, action, entity_type, entity_id, old_values, new_values, created_at',
          { count: 'exact' },
        )
        .eq('org_id', orgId!)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (action !== 'ALL') q = q.eq('action', action);
      if (entityType.trim()) {
        q = q.ilike('entity_type', `%${entityType.trim()}%`);
      }
      if (userFilter.trim()) {
        q = q.eq('user_id', userFilter.trim());
      }
      if (fromDate) q = q.gte('created_at', `${fromDate}T00:00:00`);
      if (toDate) q = q.lte('created_at', `${toDate}T23:59:59`);

      const { data, error, count } = await q;
      if (error) throw error;

      const rows = (data ?? []) as Omit<AuditRow, 'profiles'>[];
      const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
      const nameByUser = new Map<string, string | null>();
      if (userIds.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
        for (const p of profiles ?? []) {
          nameByUser.set(p.id, p.full_name);
        }
      }

      return {
        rows: rows.map((r) => ({
          ...r,
          profiles: { full_name: nameByUser.get(r.user_id) ?? null },
        })) as AuditRow[],
        total: count ?? 0,
      };
    },
  });

  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / PAGE_SIZE));

  if (roleLoading) {
    return (
      <div className="space-y-4 p-6">
        <PageHeader title="Audit log" description="Organization change history" />
        <DataTableSkeleton rows={8} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-4 p-6">
        <PageHeader title="Audit log" description="Organization change history" />
        <EmptyState
          title="Access restricted"
          description="Only OWNER and ADMIN can view the audit log."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <PageHeader
        title="Audit log"
        description="Append-only history of creates, updates, deletes, and approvals for this organization."
      />

      <div className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-xs font-medium text-muted-foreground">
          Action
          <select
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
            value={action}
            onChange={(e) => {
              setPage(1);
              setAction(e.target.value as (typeof ACTIONS)[number]);
            }}
          >
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Entity type
          <input
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
            placeholder="e.g. vendor, sale_order"
            value={entityType}
            onChange={(e) => {
              setPage(1);
              setEntityType(e.target.value);
            }}
          />
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          User id
          <input
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm font-mono"
            placeholder="uuid"
            value={userFilter}
            onChange={(e) => {
              setPage(1);
              setUserFilter(e.target.value);
            }}
          />
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          From
          <input
            type="date"
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
            value={fromDate}
            onChange={(e) => {
              setPage(1);
              setFromDate(e.target.value);
            }}
          />
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          To
          <input
            type="date"
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
            value={toDate}
            onChange={(e) => {
              setPage(1);
              setToDate(e.target.value);
            }}
          />
        </label>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {query.isLoading ? (
          <div className="p-4">
            <DataTableSkeleton rows={8} cols={5} />
          </div>
        ) : !query.data?.rows.length ? (
          <EmptyState
            title="No audit events"
            description="Mutations across the app write here. Perform a create/update to see the first row."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="border-b border-border bg-muted text-xs font-medium uppercase text-muted-foreground">
                <tr>
                  <th className="w-10 px-3 py-3" />
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Entity id</th>
                </tr>
              </thead>
              <tbody>
                {query.data.rows.map((row) => {
                  const open = expanded === row.id;
                  return (
                    <Fragment key={row.id}>
                      <tr
                        className="cursor-pointer border-b border-border/70 hover:bg-muted/40"
                        onClick={() => setExpanded(open ? null : row.id)}
                      >
                        <td className="px-3 py-3 text-muted-foreground">
                          {open ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                          {row.created_at ? formatDateTime(row.created_at) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {row.profiles?.full_name || row.user_id.slice(0, 8)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={row.action} />
                        </td>
                        <td className="px-4 py-3 font-medium">{row.entity_type}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {row.entity_id ? row.entity_id.slice(0, 8) : '—'}
                        </td>
                      </tr>
                      {open ? (
                        <tr className="border-b border-border bg-muted/20">
                          <td colSpan={6} className="px-4 py-4">
                            <div className="grid gap-4 md:grid-cols-2">
                              <div>
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  Old values
                                </p>
                                <pre className="max-h-64 overflow-auto rounded-md border border-border bg-background p-3 text-xs">
                                  {prettyJson(row.old_values)}
                                </pre>
                              </div>
                              <div>
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  New values
                                </p>
                                <pre className="max-h-64 overflow-auto rounded-md border border-border bg-background p-3 text-xs">
                                  {prettyJson(row.new_values)}
                                </pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {query.data?.total ?? 0} event{(query.data?.total ?? 0) === 1 ? '' : 's'}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="flex items-center text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
