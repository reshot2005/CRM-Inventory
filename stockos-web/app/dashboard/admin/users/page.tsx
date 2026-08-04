'use client';

import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { api } from '@/lib/api/api-client';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import type { AppRole } from '@/lib/auth/auth-context';
import { PageHeader } from '@/components/ui/enterprise';

interface UserRow {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  companyName: string | null;
  jobTitle: string | null;
  role: AppRole;
  status: string;
  allowedLocations: string[];
  createdAt: string;
}

interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function AdminUsersPage() {
  const { user } = useRequireAuth();
  const queryClient = useQueryClient();
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const isAdmin = user?.profile?.role === 'ADMIN';

  const { data: pending = [] } = useQuery({
    queryKey: ['users', 'pending'],
    queryFn: () => api.get<UserRow[]>('/api/v1/users/pending'),
    refetchInterval: 30_000,
    enabled: isAdmin,
  });

  const { data: allWrap } = useQuery({
    queryKey: ['users', 'all'],
    queryFn: () =>
      api.getWithMeta<UserRow[], PageMeta>('/api/v1/users', {
        limit: 100,
        page: 1,
      }),
    enabled: isAdmin,
  });

  const approveMut = useMutation({
    mutationFn: ({ id, role }: { id: string; role: AppRole }) =>
      api.patch(`/api/v1/users/${id}/approve`, { role }),
    onSuccess: () => {
      toast.success('User approved');
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.patch(`/api/v1/users/${id}/reject`, { reason }),
    onSuccess: () => {
      toast.success('User rejected');
      setRejectId(null);
      setRejectReason('');
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleMut = useMutation({
    mutationFn: ({ id, role }: { id: string; role: AppRole }) =>
      api.patch(`/api/v1/users/${id}`, { role }),
    onSuccess: () => {
      toast.success('Role updated');
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const allUsers = allWrap?.data ?? [];

  if (!isAdmin) {
    return (
      <div className="rounded-lg border border-[#E2E8F0] bg-white p-8 text-center text-[#64748B]">
        You do not have access to this page.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader title="User management" description="Review pending access and maintain workspace roles." />

      {pending.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-lg font-medium text-[#0F172A]">Pending approval</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {pending.map((u) => (
              <div
                key={u.id}
                className="rounded-lg border border-[#E2E8F0] bg-white p-4 shadow-sm"
              >
                <p className="font-medium text-[#0F172A]">{u.name}</p>
                <p className="text-sm text-[#64748B]">{u.email}</p>
                {u.phone ? (
                  <p className="text-sm text-[#64748B]">{u.phone}</p>
                ) : null}
                {u.companyName ? (
                  <p className="text-sm font-medium text-[#334155]">{u.companyName}</p>
                ) : null}
                {u.jobTitle ? (
                  <p className="text-xs text-[#94A3B8]">{u.jobTitle}</p>
                ) : null}
                <p className="mt-1 text-xs text-[#94A3B8]">
                  Registered{' '}
                  {formatDistanceToNow(new Date(u.createdAt), { addSuffix: true })}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      approveMut.mutate({ id: u.id, role: 'STAFF' })
                    }
                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white"
                  >
                    Approve (Staff)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejectId(u.id)}
                    className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-4 text-lg font-medium text-[#0F172A]">All users</h2>
        <div className="overflow-hidden rounded-lg border border-[#E2E8F0] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs uppercase text-[#64748B]">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {allUsers.map((u) => (
                <tr key={u.id} className="border-b border-[#F1F5F9]">
                  <td className="px-4 py-3 font-medium text-[#0F172A]">
                    <div>{u.name}</div>
                    {u.jobTitle ? (
                      <div className="text-xs font-normal text-[#94A3B8]">{u.jobTitle}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-[#334155]">
                    {u.companyName ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-[#334155]">{u.email}</td>
                  <td className="px-4 py-3 text-[#334155]">{u.phone ?? '—'}</td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      onChange={(e) =>
                        roleMut.mutate({
                          id: u.id,
                          role: e.target.value as AppRole,
                        })
                      }
                      className="rounded border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-1 text-xs"
                    >
                      {(['ADMIN', 'MANAGER', 'STAFF', 'VIEWER'] as const).map(
                        (r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ),
                      )}
                    </select>
                  </td>
                  <td className="px-4 py-3">{u.status}</td>
                  <td className="px-4 py-3 text-xs text-[#64748B]">
                    {formatDistanceToNow(new Date(u.createdAt), {
                      addSuffix: true,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {rejectId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="font-medium text-[#0F172A]">Rejection reason</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="mt-2 w-full rounded-md border border-[#E2E8F0] p-2 text-sm"
              rows={3}
              minLength={5}
              placeholder="At least 5 characters"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectId(null)}
                className="rounded-md border border-[#E2E8F0] px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (rejectReason.trim().length < 5) {
                    toast.error('Reason must be at least 5 characters');
                    return;
                  }
                  rejectMut.mutate({ id: rejectId, reason: rejectReason.trim() });
                }}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
