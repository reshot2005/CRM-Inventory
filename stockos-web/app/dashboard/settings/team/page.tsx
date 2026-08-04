'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy, UserPlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useUserId } from '@/lib/hooks/useUserId';
import { useOrgRole, type OrgRole } from '@/lib/hooks/useOrgRole';
import { PageHeader, StatusBadge } from '@/components/ui/enterprise';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { DataTableSkeleton } from '@/components/ui/DataTableSkeleton';
import { writeAuditLog } from '@/lib/audit/write-audit-log';

type MemberRow = {
  id: string;
  user_id: string;
  role: OrgRole;
  status: string;
  joined_at: string | null;
  invited_at: string | null;
  profiles: { full_name: string | null } | null;
};

type InviteRow = {
  id: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'STAFF';
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

const INVITE_ROLES: Array<'ADMIN' | 'MANAGER' | 'STAFF'> = [
  'ADMIN',
  'MANAGER',
  'STAFF',
];

export default function TeamSettingsPage() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);
  const { orgId, role, canManageTeam, loading: roleLoading } = useOrgRole();

  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MANAGER' | 'STAFF'>(
    'STAFF',
  );

  const membersQuery = useQuery({
    queryKey: ['org-members', orgId ?? ''],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_members')
        .select('id, user_id, role, status, joined_at, invited_at, profiles(full_name)')
        .eq('org_id', orgId!)
        .order('joined_at', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as MemberRow[];
    },
  });

  const invitesQuery = useQuery({
    queryKey: ['org-invites', orgId ?? ''],
    enabled: Boolean(orgId) && canManageTeam,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_invites')
        .select('id, email, role, token, expires_at, accepted_at, created_at')
        .eq('org_id', orgId!)
        .is('accepted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as InviteRow[];
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      if (!userId || !orgId) throw new Error('Not ready');
      const trimmed = email.trim().toLowerCase();
      if (!trimmed.includes('@')) throw new Error('Enter a valid email');

      const { data, error } = await supabase
        .from('organization_invites')
        .insert({
          org_id: orgId,
          email: trimmed,
          role: inviteRole,
          invited_by: userId,
        })
        .select('id, token, email, role')
        .single();
      if (error) throw error;

      await writeAuditLog({
        userId,
        orgId,
        action: 'CREATE',
        entityType: 'organization_invite',
        entityId: data.id,
        newValues: { email: data.email, role: data.role },
      });

      return data;
    },
    onSuccess: (data) => {
      toast.success('Invite created — copy the link and send it to your teammate');
      setEmail('');
      void queryClient.invalidateQueries({ queryKey: ['org-invites'] });
      const link = `${window.location.origin}/invite/accept?token=${data.token}`;
      void navigator.clipboard.writeText(link).then(
        () => toast.message('Invite link copied to clipboard'),
        () => undefined,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeRoleMutation = useMutation({
    mutationFn: async ({
      memberId,
      nextRole,
      targetUserId,
      prevRole,
    }: {
      memberId: string;
      nextRole: OrgRole;
      targetUserId: string;
      prevRole: OrgRole;
    }) => {
      if (!canManageTeam || !orgId || !userId) throw new Error('Not allowed');
      if (nextRole === 'OWNER') throw new Error('Cannot assign OWNER via role change');
      const { error } = await supabase
        .from('organization_members')
        .update({ role: nextRole })
        .eq('id', memberId);
      if (error) throw error;
      await writeAuditLog({
        userId,
        orgId,
        action: 'UPDATE',
        entityType: 'organization_member',
        entityId: targetUserId,
        oldValues: { role: prevRole },
        newValues: { role: nextRole },
      });
    },
    onSuccess: () => {
      toast.success('Role updated');
      void queryClient.invalidateQueries({ queryKey: ['org-members'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (member: MemberRow) => {
      if (!canManageTeam || !orgId || !userId) throw new Error('Not allowed');
      if (member.role === 'OWNER') {
        throw new Error('OWNER cannot be removed — transfer ownership first (out of scope)');
      }
      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('id', member.id);
      if (error) throw error;
      await writeAuditLog({
        userId,
        orgId,
        action: 'DELETE',
        entityType: 'organization_member',
        entityId: member.user_id,
        oldValues: { role: member.role, status: member.status },
      });
    },
    onSuccess: () => {
      toast.success('Member removed');
      void queryClient.invalidateQueries({ queryKey: ['org-members'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeInviteMutation = useMutation({
    mutationFn: async (invite: InviteRow) => {
      if (!canManageTeam || !userId || !orgId) throw new Error('Not allowed');
      const { error } = await supabase
        .from('organization_invites')
        .delete()
        .eq('id', invite.id);
      if (error) throw error;
      await writeAuditLog({
        userId,
        orgId,
        action: 'DELETE',
        entityType: 'organization_invite',
        entityId: invite.id,
        oldValues: { email: invite.email, role: invite.role },
      });
    },
    onSuccess: () => {
      toast.success('Invite revoked');
      void queryClient.invalidateQueries({ queryKey: ['org-invites'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resendInvite = (invite: InviteRow) => {
    const link = `${window.location.origin}/invite/accept?token=${invite.token}`;
    void navigator.clipboard.writeText(link).then(
      () => toast.success('Invite link copied — send it to the teammate'),
      () => toast.message(link),
    );
  };

  if (roleLoading || !userId) {
    return (
      <div className="space-y-4 p-6">
        <PageHeader title="Team & Roles" description="Manage organization members" />
        <DataTableSkeleton rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      <PageHeader
        title="Team & Roles"
        description={`Your role: ${role ?? '—'} · Invite teammates to the same organization data`}
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Members
        </h2>
        {membersQuery.isLoading ? (
          <DataTableSkeleton rows={4} />
        ) : !membersQuery.data?.length ? (
          <EmptyState title="No members" description="Organization membership is empty." />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {membersQuery.data.map((m) => {
                  const isSelf = m.user_id === userId;
                  const isOwnerRow = m.role === 'OWNER';
                  return (
                    <tr key={m.id} className="border-t border-border">
                      <td className="px-4 py-3">
                        {m.profiles?.full_name || m.user_id.slice(0, 8)}
                        {isSelf ? (
                          <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        {canManageTeam && !isOwnerRow ? (
                          <select
                            className="rounded-md border border-border bg-background px-2 py-1"
                            value={m.role}
                            onChange={(e) =>
                              changeRoleMutation.mutate({
                                memberId: m.id,
                                nextRole: e.target.value as OrgRole,
                                targetUserId: m.user_id,
                                prevRole: m.role,
                              })
                            }
                          >
                            {INVITE_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        ) : (
                          m.role
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={m.status} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {m.joined_at
                          ? new Date(m.joined_at).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {isOwnerRow ? (
                          <span
                            className="text-xs text-muted-foreground"
                            title="OWNER cannot be removed or demoted without ownership transfer (out of scope this week)"
                          >
                            Protected
                          </span>
                        ) : canManageTeam ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            disabled={removeMutation.isPending}
                            onClick={() => {
                              if (
                                window.confirm(
                                  'Remove this member from the organization?',
                                )
                              ) {
                                removeMutation.mutate(m);
                              }
                            }}
                          >
                            Remove
                          </Button>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canManageTeam ? (
        <>
          <section className="space-y-3 rounded-lg border border-border p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <UserPlus className="h-4 w-4" /> Invite teammate
            </h2>
            <p className="text-sm text-muted-foreground">
              Cannot invite another OWNER. Email delivery is via shared invite
              link (copy / resend) until a transactional provider is wired.
            </p>
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <label className="flex-1 text-sm">
                Email
                <input
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teammate@company.com"
                />
              </label>
              <label className="text-sm">
                Role
                <select
                  className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 md:w-40"
                  value={inviteRole}
                  onChange={(e) =>
                    setInviteRole(e.target.value as 'ADMIN' | 'MANAGER' | 'STAFF')
                  }
                >
                  {INVITE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                disabled={inviteMutation.isPending || !email.trim()}
                onClick={() => inviteMutation.mutate()}
              >
                {inviteMutation.isPending ? 'Sending…' : 'Create invite'}
              </Button>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Pending invites
            </h2>
            {!invitesQuery.data?.length ? (
              <p className="text-sm text-muted-foreground">No pending invites.</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Expires</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invitesQuery.data.map((inv) => (
                      <tr key={inv.id} className="border-t border-border">
                        <td className="px-4 py-3">{inv.email}</td>
                        <td className="px-4 py-3">{inv.role}</td>
                        <td className="px-4 py-3">
                          {new Date(inv.expires_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => resendInvite(inv)}
                            >
                              <Copy className="mr-1 h-3 w-3" /> Resend
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => revokeInviteMutation.mutate(inv)}
                            >
                              Revoke
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Only OWNER and ADMIN can invite or remove teammates.
        </p>
      )}
    </div>
  );
}
