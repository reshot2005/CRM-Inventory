'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useUserId } from '@/lib/hooks/useUserId';
import { useOrgRole } from '@/lib/hooks/useOrgRole';
import { useRealtimeQuery } from '@/lib/hooks/useRealtimeQuery';
import { EmptyState, PageHeader, Pagination, SearchToolbar } from '@/components/ui/enterprise';
import { DataTableSkeleton } from '@/components/ui/DataTableSkeleton';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { writeAuditLog } from '@/lib/audit/write-audit-log';

// ── Types ────────────────────────────────────────────────────

type LocationType = 'FACTORY' | 'HUB' | 'WAREHOUSE';

interface LocationRow {
  id: string;
  user_id: string;
  name: string;
  code: string;
  type: LocationType;
  address: string | null;
  is_active: boolean;
  created_at: string;
}

interface LocationWithStock extends LocationRow {
  item_count: number;
  total_quantity: number;
}

// ── Zod Schema ───────────────────────────────────────────────

const locationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  code: z
    .string()
    .min(1, 'Code is required')
    .max(20)
    .regex(/^[A-Za-z0-9_-]+$/, 'Only letters, numbers, hyphens & underscores'),
  type: z.enum(['FACTORY', 'HUB', 'WAREHOUSE'], { message: 'Select a type' }),
  address: z.string().max(500),
});

type LocationFormValues = {
  name: string;
  code: string;
  type: 'FACTORY' | 'HUB' | 'WAREHOUSE';
  address: string;
};

const defaultFormValues: LocationFormValues = {
  name: '',
  code: '',
  type: 'WAREHOUSE',
  address: '',
};

const LOCATION_TYPES: LocationType[] = ['FACTORY', 'HUB', 'WAREHOUSE'];

const TYPE_BADGE: Record<LocationType, string> = {
  FACTORY: 'bg-purple-100 text-purple-800',
  HUB: 'bg-blue-100 text-blue-800',
  WAREHOUSE: 'bg-emerald-100 text-emerald-800',
};

// ── Helpers ──────────────────────────────────────────────────

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

// ── Page Component ───────────────────────────────────────────

export default function AdminLocationsPage() {
  const userId = useUserId();
  const { isAdmin, loading: roleLoading } = useOrgRole();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      router.replace('/unauthorized');
    }
  }, [roleLoading, isAdmin, router]);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 300);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationRow | null>(null);
  const [confirmToggleId, setConfirmToggleId] = useState<string | null>(null);

  // ── Fetch locations + aggregate stock ─────────────────────

  const fetchLocations = useCallback(async (): Promise<{ rows: LocationWithStock[]; total: number }> => {
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let locQuery = supabase
      .from('locations')
      .select('*', { count: 'exact' })
      .eq('user_id', userId!)
      .order('created_at', { ascending: false });

    if (debouncedSearch) {
      const q = debouncedSearch.trim();
      locQuery = locQuery.or(`name.ilike.%${q}%,code.ilike.%${q}%,type.ilike.%${q}%`);
    }

    const { data: locations, error, count } = await locQuery.range(from, to);

    if (error) throw error;
    if (!locations || locations.length === 0) return { rows: [], total: count ?? 0 };

    const locationIds = (locations as LocationRow[]).map((l) => l.id);

    const { data: qtyRows, error: qtyErr } = await supabase
      .from('inventory')
      .select('location_id, quantity')
      .eq('user_id', userId!)
      .in('location_id', locationIds);

    if (qtyErr) throw qtyErr;

    const countMap = new Map<string, number>();
    const qtyMap = new Map<string, number>();

    for (const row of (qtyRows ?? []) as Array<{ location_id: string; quantity: number }>) {
      if (row.quantity > 0) {
        countMap.set(row.location_id, (countMap.get(row.location_id) ?? 0) + 1);
      }
      qtyMap.set(row.location_id, (qtyMap.get(row.location_id) ?? 0) + row.quantity);
    }

    return {
      rows: (locations as LocationRow[]).map((loc) => ({
        ...loc,
        item_count: countMap.get(loc.id) ?? 0,
        total_quantity: qtyMap.get(loc.id) ?? 0,
      })),
      total: count ?? 0,
    };
  }, [supabase, userId, page, debouncedSearch]);

  const { data: locationsPage, isLoading } = useRealtimeQuery<{ rows: LocationWithStock[]; total: number }>(
    ['locations', userId ?? '', debouncedSearch, page],
    'locations',
    fetchLocations,
    !!userId,
  );

  const locations = locationsPage?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil((locationsPage?.total ?? 0) / PAGE_SIZE));

  // ── Create mutation ───────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (values: LocationFormValues) => {
      if (!userId) throw new Error('Not authenticated');

      const { data: existing } = await supabase
        .from('locations')
        .select('id')
        .eq('user_id', userId)
        .eq('code', values.code)
        .maybeSingle();

      if (existing) throw new Error(`Location code "${values.code}" already exists`);

      const { data: location, error: locErr } = await supabase
        .from('locations')
        .insert({
          user_id: userId,
          name: values.name,
          code: values.code,
          type: values.type,
          address: values.address || null,
        })
        .select('id')
        .single();

      if (locErr) throw locErr;

      const { data: activeItems, error: itemsErr } = await supabase
        .from('items')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (itemsErr) throw itemsErr;

      if (activeItems && activeItems.length > 0) {
        const inventoryRows = activeItems.map((item: { id: string }) => ({
          user_id: userId,
          location_id: location.id,
          item_id: item.id,
          quantity: 0,
          reserved_qty: 0,
          unit_cost: 0,
        }));

        const { error: invErr } = await supabase.from('inventory').insert(inventoryRows);
        if (invErr) throw invErr;
      }

      await writeAuditLog({
        userId,
        action: 'CREATE',
        entityType: 'location',
        entityId: location.id,
        newValues: {
          name: values.name,
          code: values.code,
          type: values.type,
        },
      });
    },
    onSuccess: () => {
      toast.success('Location created');
      void queryClient.invalidateQueries({ queryKey: ['locations'] });
      closeModal();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Edit mutation ─────────────────────────────────────────

  const editMutation = useMutation({
    mutationFn: async ({
      locationId,
      values,
    }: {
      locationId: string;
      values: LocationFormValues;
    }) => {
      if (!userId) throw new Error('Not authenticated');

      const { data: dup } = await supabase
        .from('locations')
        .select('id')
        .eq('user_id', userId)
        .eq('code', values.code)
        .neq('id', locationId)
        .maybeSingle();

      if (dup) throw new Error(`Location code "${values.code}" already in use`);

      const { error } = await supabase
        .from('locations')
        .update({
          name: values.name,
          code: values.code,
          type: values.type,
          address: values.address || null,
        })
        .eq('id', locationId);

      if (error) throw error;

      await writeAuditLog({
        userId,
        action: 'UPDATE',
        entityType: 'location',
        entityId: locationId,
        newValues: {
          name: values.name,
          code: values.code,
          type: values.type,
        },
      });
    },
    onSuccess: () => {
      toast.success('Location updated');
      void queryClient.invalidateQueries({ queryKey: ['locations'] });
      closeModal();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Toggle active/inactive ────────────────────────────────

  const toggleMutation = useMutation({
    mutationFn: async (locationId: string) => {
      if (!userId) throw new Error('Not authenticated');
      const target = locations.find((l) => l.id === locationId);
      if (!target) throw new Error('Location not found');

      const { error } = await supabase
        .from('locations')
        .update({ is_active: !target.is_active })
        .eq('id', locationId);

      if (error) throw error;

      await writeAuditLog({
        userId,
        action: 'UPDATE',
        entityType: 'location',
        entityId: locationId,
        oldValues: { is_active: target.is_active },
        newValues: { is_active: !target.is_active },
      });
    },
    onSuccess: (_data, locationId) => {
      const target = locations.find((l) => l.id === locationId);
      toast.success(target?.is_active ? 'Location deactivated' : 'Location activated');
      void queryClient.invalidateQueries({ queryKey: ['locations'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Modal helpers ─────────────────────────────────────────

  function openCreate() {
    setEditingLocation(null);
    setModalOpen(true);
  }

  function openEdit(loc: LocationRow) {
    setEditingLocation(loc);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingLocation(null);
  }

  // ── Render ────────────────────────────────────────────────

  if (roleLoading || !isAdmin) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Checking access…</div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Locations" description="Manage factories, hubs, and warehouses." actions={<Button type="button" onClick={openCreate}><Plus className="h-4 w-4" />Add location</Button>} />

      {/* Search */}
      <SearchToolbar value={search} onChange={setSearch} placeholder="Search name, code, or type…">
        <span className="text-xs text-muted-foreground">
          {locationsPage?.total ?? 0} location{(locationsPage?.total ?? 0) !== 1 ? 's' : ''}
        </span>
      </SearchToolbar>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-[#E2E8F0] bg-white shadow-[0_1px_4px_rgba(30,42,74,0.07)]">
        {isLoading ? (
          <div className="p-4">
            <DataTableSkeleton rows={5} cols={8} />
          </div>
        ) : locations.length === 0 ? (
          <EmptyState
            title="No locations yet"
            description="Add your first location to start tracking inventory."
            action={<Button type="button" onClick={openCreate}>Add your first location</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-medium uppercase text-[#64748B]">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Address</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3">Total Qty</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {locations.map((loc) => (
                  <tr
                    key={loc.id}
                    className="border-b border-[#F1F5F9] last:border-0"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#0F172A]">{loc.name}</p>
                      <p className="text-xs text-[#94A3B8]">
                        {new Date(loc.created_at).toLocaleDateString('en-IN')}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[#334155]">
                      {loc.code}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE[loc.type]}`}
                      >
                        {loc.type}
                      </span>
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-[#334155]">
                      {loc.address ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-[#334155]">
                      {loc.item_count}
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-[#334155]">
                      {loc.total_quantity.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          loc.is_active
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {loc.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(loc)}
                          className="text-[#1E90FF] hover:underline"
                          title="Edit"
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmToggleId(loc.id)}
                          className={
                            loc.is_active
                              ? 'text-red-600 hover:underline'
                              : 'text-emerald-600 hover:underline'
                          }
                          title={loc.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {loc.is_active ? '⏸' : '▶'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

      {/* Create / Edit Modal */}
      {modalOpen && (
        <LocationFormModal
          location={editingLocation}
          onClose={closeModal}
          onSubmitCreate={(v) => createMutation.mutate(v)}
          onSubmitEdit={(id, v) => editMutation.mutate({ locationId: id, values: v })}
          isSubmitting={createMutation.isPending || editMutation.isPending}
        />
      )}

      {/* Toggle confirmation dialog */}
      {confirmToggleId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-w-sm rounded-lg bg-white p-6 shadow-xl">
            {(() => {
              const target = locations.find((l) => l.id === confirmToggleId);
              const isActive = target?.is_active ?? true;
              return (
                <>
                  <p className="text-[#0F172A]">
                    {isActive ? 'Deactivate' : 'Activate'} this location?
                  </p>
                  <p className="mt-1 text-sm text-[#64748B]">
                    {isActive
                      ? 'The location will be hidden from active lists but data is preserved.'
                      : 'The location will be visible again in active lists.'}
                  </p>
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmToggleId(null)}
                      className="rounded-md border border-[#E2E8F0] px-3 py-1.5 text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={toggleMutation.isPending}
                      onClick={() => {
                        toggleMutation.mutate(confirmToggleId);
                        setConfirmToggleId(null);
                      }}
                      className={`rounded-md px-3 py-1.5 text-sm text-white disabled:opacity-50 ${
                        isActive ? 'bg-red-600' : 'bg-emerald-600'
                      }`}
                    >
                      {isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal Form Component ────────────────────────────────────

function LocationFormModal({
  location,
  onClose,
  onSubmitCreate,
  onSubmitEdit,
  isSubmitting,
}: {
  location: LocationRow | null;
  onClose: () => void;
  onSubmitCreate: (values: LocationFormValues) => void;
  onSubmitEdit: (locationId: string, values: LocationFormValues) => void;
  isSubmitting: boolean;
}) {
  const isEdit = !!location;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LocationFormValues>({
    resolver: zodResolver(locationSchema) as Resolver<LocationFormValues>,
    defaultValues: isEdit
      ? {
          name: location.name,
          code: location.code,
          type: location.type,
          address: location.address ?? '',
        }
      : defaultFormValues,
  });

  function onSubmit(values: LocationFormValues) {
    if (isEdit) {
      onSubmitEdit(location.id, values);
    } else {
      onSubmitCreate(values);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg bg-white shadow-xl"
        role="dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
          <h2 className="text-lg font-semibold text-[#0F172A]">
            {isEdit ? 'Edit Location' : 'Add Location'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[#64748B] hover:text-[#0F172A]"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#334155]">
              Name *
            </label>
            <input
              {...register('name')}
              className="w-full rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#1E90FF]"
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-[#334155]">
                Code *
              </label>
              <input
                {...register('code')}
                placeholder="WH-DELHI-01"
                disabled={isEdit}
                className="w-full rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm font-mono text-[#0F172A] outline-none focus:border-[#1E90FF] disabled:opacity-60"
              />
              {errors.code && (
                <p className="mt-1 text-xs text-red-600">{errors.code.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#334155]">
                Type *
              </label>
              <select
                {...register('type')}
                className="w-full rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#1E90FF]"
              >
                {LOCATION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0) + t.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
              {errors.type && (
                <p className="mt-1 text-xs text-red-600">{errors.type.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[#334155]">
              Address
            </label>
            <textarea
              {...register('address')}
              rows={2}
              className="w-full rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#1E90FF]"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-[#E2E8F0] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#334155]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-[#1E90FF] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#187bcd] disabled:opacity-50"
            >
              {isSubmitting
                ? 'Saving…'
                : isEdit
                  ? 'Update Location'
                  : 'Create Location'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
