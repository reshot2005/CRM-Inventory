'use client';

import { useMemo, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/enterprise';
import { DataTableSkeleton } from '@/components/ui/DataTableSkeleton';
import { createClient, type Tables } from '@/lib/supabase/client';
import { useRealtimeQuery } from '@/lib/hooks/useRealtimeQuery';
import { useLocations } from '@/lib/hooks/useLocations';
import { MACHINE_STATUSES } from './types';
import { writeAuditLog } from '@/lib/audit/write-audit-log';

const machineSchema = z.object({
  name: z.string().min(1, 'Name required'),
  code: z.string().min(1, 'Code required'),
  location_id: z.string(),
});

type MachineFormValues = z.infer<typeof machineSchema>;

interface MachineRow extends Tables<'machines'> {
  locations: { name: string } | null;
}

export function MachinesDrawer({
  open,
  onOpenChange,
  userId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
}) {
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);
  const [showCreate, setShowCreate] = useState(false);

  const locationsQuery = useLocations(userId);
  const locations = locationsQuery.data ?? [];

  const machinesQuery = useRealtimeQuery<MachineRow[]>(
    ['machines', userId ?? ''],
    'machines',
    async () => {
      const { data, error } = await supabase
        .from('machines')
        .select('*, locations(name)')
        .eq('user_id', userId!)
        .order('name');
      if (error) throw error;
      return (data ?? []) as unknown as MachineRow[];
    },
    !!userId && open,
  );

  const machines = machinesQuery.data ?? [];

  const form = useForm<MachineFormValues>({
    resolver: zodResolver(machineSchema) as Resolver<MachineFormValues>,
    defaultValues: { name: '', code: '', location_id: '' },
  });

  const createMutation = useMutation({
    mutationFn: async (values: MachineFormValues) => {
      if (!userId) throw new Error('Not authenticated');
      const { data: machine, error } = await supabase.from('machines').insert({
        user_id: userId,
        name: values.name.trim(),
        code: values.code.trim().toUpperCase(),
        location_id: values.location_id || null,
        status: 'IDLE',
      }).select('id').single();
      if (error) throw new Error(error.message);

      await writeAuditLog({
        userId,
        action: 'CREATE',
        entityType: 'machine',
        entityId: machine.id,
        newValues: {
          name: values.name.trim(),
          code: values.code.trim().toUpperCase(),
          status: 'IDLE',
        },
      });
    },
    onSuccess: () => {
      toast.success('Machine added');
      void queryClient.invalidateQueries({ queryKey: ['machines'] });
      void queryClient.invalidateQueries({ queryKey: ['production-machines-lookup'] });
      form.reset();
      setShowCreate(false);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to add machine'),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      if (!userId) throw new Error('Not authenticated');
      const machine = machines.find((m) => m.id === id);
      const { error } = await supabase
        .from('machines')
        .update({ status })
        .eq('id', id)
        .eq('user_id', userId);
      if (error) throw new Error(error.message);

      await writeAuditLog({
        userId,
        action: 'UPDATE',
        entityType: 'machine',
        entityId: id,
        oldValues: { status: machine?.status },
        newValues: { status },
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['machines'] });
      void queryClient.invalidateQueries({ queryKey: ['production-machines-lookup'] });
      void queryClient.invalidateQueries({ queryKey: ['production_orders'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update machine status'),
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/30"
      role="presentation"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-card p-6 shadow-xl"
        role="dialog"
        aria-label="Machines"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Machines</h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!showCreate ? (
          <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            Add machine
          </Button>
        ) : (
          <form
            onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
            className="mb-4 space-y-3 rounded-md border border-border p-3"
          >
            <label className="block text-xs font-medium text-muted-foreground">
              Name
              <input
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                {...form.register('name')}
              />
              {form.formState.errors.name ? (
                <span className="text-xs text-destructive">{form.formState.errors.name.message}</span>
              ) : null}
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              Code
              <input
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                {...form.register('code')}
              />
              {form.formState.errors.code ? (
                <span className="text-xs text-destructive">{form.formState.errors.code.message}</span>
              ) : null}
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              Location (optional)
              <select
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                {...form.register('location_id')}
              >
                <option value="">Unassigned</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.code})
                  </option>
                ))}
              </select>
            </label>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowCreate(false);
                  form.reset();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Adding…' : 'Add machine'}
              </Button>
            </div>
          </form>
        )}

        <div className="mt-4 space-y-2">
          {machinesQuery.isLoading ? (
            <DataTableSkeleton rows={4} cols={2} />
          ) : machines.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No machines yet.</p>
          ) : (
            machines.map((machine) => (
              <div
                key={machine.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{machine.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {machine.code} · {machine.locations?.name ?? 'Unassigned'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={machine.status ?? 'IDLE'} />
                  <select
                    className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                    value={machine.status ?? 'IDLE'}
                    disabled={statusMutation.isPending}
                    onChange={(e) =>
                      statusMutation.mutate({ id: machine.id, status: e.target.value })
                    }
                  >
                    {MACHINE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
