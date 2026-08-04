'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Plus,
  ChevronDown,
  ChevronRight,
  X,
  Trash2,
  Loader2,
  Banknote,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';
import { EmptyState, PageHeader, Pagination, SearchToolbar } from '@/components/ui/enterprise';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { useUserId } from '@/lib/hooks/useUserId';
import { useRealtimeQuery } from '@/lib/hooks/useRealtimeQuery';
import { LOOKUP_KEYS } from '@/lib/query/lookups';
import {
  generateOrderNumber,
  processStockMovement,
} from '@/lib/stock/movements';
import { insertNotification } from '@/lib/stock/manufacturing';
import { writeAuditLog } from '@/lib/audit/write-audit-log';

// ── Row / embed shapes ─────────────────────────────────────

interface CustomerEmbed {
  id: string;
  customer_id_display: string;
  company_name: string | null;
  primary_contact: string;
}

interface LocationEmbed {
  id: string;
  name: string;
}

interface ItemEmbed {
  id: string;
  standardized_name: string;
  product_code: string;
}

interface SaleOrderLineRow {
  id: string;
  user_id: string;
  sale_order_id: string;
  item_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  items: ItemEmbed | null;
}

interface SaleOrderRow {
  id: string;
  user_id: string;
  order_number: string;
  customer_id: string;
  status: string;
  location_id: string | null;
  total_amount: number;
  amount_paid: number;
  payment_status: string;
  notes: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  created_at: string;
  customers: CustomerEmbed | null;
  locations: LocationEmbed | null;
  sale_order_lines: SaleOrderLineRow[];
}

interface CustomerOption {
  id: string;
  customer_id_display: string;
  company_name: string | null;
  primary_contact: string;
}

interface LocationOption {
  id: string;
  name: string;
}

interface ItemOption {
  id: string;
  standardized_name: string;
  product_code: string;
}

// ── Constants ───────────────────────────────────────────────

type OrderStatus =
  | 'DRAFT'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'DISPATCHED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURNED';

type PaymentStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE';

const ORDER_STATUS_TABS: readonly (OrderStatus | 'ALL')[] = [
  'ALL',
  'DRAFT',
  'CONFIRMED',
  'DISPATCHED',
  'DELIVERED',
  'CANCELLED',
] as const;

const STATUS_BADGE: Record<OrderStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  PROCESSING: 'bg-indigo-100 text-indigo-800',
  DISPATCHED: 'bg-amber-100 text-amber-800',
  DELIVERED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-red-100 text-red-800',
  RETURNED: 'bg-purple-100 text-purple-800',
};

const PAY_BADGE: Record<PaymentStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  PARTIAL: 'bg-blue-100 text-blue-800',
  PAID: 'bg-emerald-100 text-emerald-800',
  OVERDUE: 'bg-red-100 text-red-800',
};

const PAGE_SIZE = 20;

const PAYMENT_MODES = ['CASH', 'UPI', 'NEFT', 'CHEQUE', 'OTHER'] as const;
type PaymentMode = (typeof PAYMENT_MODES)[number];

const paymentSchema = z.object({
  amount: z.number().min(0.01, 'Enter a valid amount'),
  mode: z.enum(PAYMENT_MODES),
  reference_no: z.string(),
  notes: z.string(),
});

type PaymentFormValues = z.infer<typeof paymentSchema>;

// ── Helpers ─────────────────────────────────────────────────

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

function statusBadge(status: string) {
  const cls = STATUS_BADGE[status as OrderStatus] ?? 'bg-gray-100 text-gray-700';
  return cls;
}

function payBadge(status: string) {
  const cls = PAY_BADGE[status as PaymentStatus] ?? 'bg-gray-100 text-gray-700';
  return cls;
}

function customerLabel(c: CustomerEmbed | null): string {
  if (!c) return '—';
  return c.company_name ?? c.primary_contact;
}

function calcPaymentStatus(
  amountPaid: number,
  totalAmount: number,
  orderStatus: string,
): PaymentStatus {
  if (amountPaid >= totalAmount) return 'PAID';
  const unpaid =
    orderStatus === 'DISPATCHED' ||
    orderStatus === 'DELIVERED' ||
    orderStatus === 'RETURNED';
  if (amountPaid > 0) return unpaid ? 'OVERDUE' : 'PARTIAL';
  return unpaid ? 'OVERDUE' : 'PENDING';
}

// ── Zod schema ──────────────────────────────────────────────

const lineSchema = z.object({
  item_id: z.string().min(1, 'Select an item'),
  quantity: z.number().min(1, 'Min 1'),
  unit_price: z.number().min(0, 'Min ₹0'),
});

const saleOrderSchema = z.object({
  customer_id: z.string().min(1, 'Select a customer'),
  location_id: z.string().min(1, 'Select a location'),
  notes: z.string(),
  lines: z.array(lineSchema).min(1, 'Add at least one line item'),
});

type SaleOrderFormValues = {
  customer_id: string;
  location_id: string;
  notes: string;
  lines: Array<{ item_id: string; quantity: number; unit_price: number }>;
};

// ── Component ───────────────────────────────────────────────

export default function SalesPage() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);

  // ui state
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState<OrderStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    orderId: string;
    orderNumber: string;
    action: 'confirm' | 'dispatch' | 'deliver' | 'cancel';
  } | null>(null);

  const debouncedSearch = useDebounced(search, 300);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusTab]);

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ── Queries ──────────────────────────────────────────────

  const { data: rawOrdersPage, isLoading } = useRealtimeQuery<{
    rows: SaleOrderRow[];
    total: number;
  }>(
    ['sale_orders', userId ?? '', statusTab, debouncedSearch, page],
    'sale_orders',
    async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let q = supabase
        .from('sale_orders')
        .select(
          '*, customers(id, customer_id_display, company_name, primary_contact), locations(id, name), sale_order_lines(*, items(id, standardized_name, product_code))',
          { count: 'exact' },
        )
        .order('created_at', { ascending: false });

      if (statusTab !== 'ALL') {
        q = q.eq('status', statusTab);
      }
      if (debouncedSearch.trim()) {
        const s = debouncedSearch.trim();
        q = q.ilike('order_number', `%${s}%`);
      }

      const { data, error, count } = await q.range(from, to).returns<SaleOrderRow[]>();
      if (error) throw error;
      return { rows: data ?? [], total: count ?? 0 };
    },
    !!userId,
  );

  const rawOrders = rawOrdersPage?.rows;
  const totalCount = rawOrdersPage?.total ?? 0;

  const { data: customers } = useQuery({
    queryKey: [...LOOKUP_KEYS.customers],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, customer_id_display, company_name, primary_contact')
        .eq('is_active', true)
        .order('company_name')
        .returns<CustomerOption[]>();
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId && showCreate,
    staleTime: 60_000,
  });

  const { data: locations } = useQuery({
    queryKey: [...LOOKUP_KEYS.locations],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name')
        .eq('is_active', true)
        .order('name')
        .returns<LocationOption[]>();
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId && showCreate,
    staleTime: 60_000,
  });

  const { data: items } = useQuery({
    queryKey: [...LOOKUP_KEYS.items],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('items')
        .select('id, standardized_name, product_code')
        .eq('is_active', true)
        .order('standardized_name')
        .returns<ItemOption[]>();
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId && showCreate,
    staleTime: 60_000,
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const rows = rawOrders ?? [];

  // ── Create order mutation ────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (values: SaleOrderFormValues) => {
      if (!userId) throw new Error('Not authenticated');

      const totalAmount = values.lines.reduce(
        (sum, l) => sum + l.quantity * l.unit_price,
        0,
      );

      const orderNumber = await generateOrderNumber(userId, 'SO');

      const { data: order, error: oErr } = await supabase
        .from('sale_orders')
        .insert({
          user_id: userId,
          order_number: orderNumber,
          customer_id: values.customer_id,
          location_id: values.location_id || null,
          status: 'DRAFT',
          total_amount: totalAmount,
          amount_paid: 0,
          payment_status: 'PENDING',
          notes: values.notes || null,
        })
        .select('id')
        .single();

      if (oErr || !order) throw new Error(oErr?.message ?? 'Failed to create order');

      const lineInserts = values.lines.map((l) => ({
        user_id: userId,
        sale_order_id: order.id as string,
        item_id: l.item_id,
        quantity: l.quantity,
        unit_price: l.unit_price,
        total_price: l.quantity * l.unit_price,
      }));

      const { error: lErr } = await supabase
        .from('sale_order_lines')
        .insert(lineInserts);

      if (lErr) throw new Error(lErr.message);

      await writeAuditLog({
        userId,
        action: 'CREATE',
        entityType: 'sale_order',
        entityId: order.id as string,
        newValues: {
          order_number: orderNumber,
          customer_id: values.customer_id,
          status: 'DRAFT',
          total_amount: totalAmount,
          line_count: values.lines.length,
        },
      });
    },
    onSuccess: () => {
      toast.success('Sale order created');
      setShowCreate(false);
      void queryClient.invalidateQueries({ queryKey: ['sale_orders'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Status transition mutations ──────────────────────────

  const confirmMutation = useMutation({
    mutationFn: async (orderId: string) => {
      if (!userId) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('sale_orders')
        .update({ status: 'CONFIRMED' })
        .eq('id', orderId);
      if (error) throw new Error(error.message);

      await writeAuditLog({
        userId,
        action: 'APPROVE',
        entityType: 'sale_order',
        entityId: orderId,
        oldValues: { status: 'DRAFT' },
        newValues: { status: 'CONFIRMED' },
      });
    },
    onSuccess: () => {
      toast.success('Order confirmed');
      void queryClient.invalidateQueries({ queryKey: ['sale_orders'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const dispatchMutation = useMutation({
    mutationFn: async (orderId: string) => {
      if (!userId) throw new Error('Not authenticated');

      const { data: order, error: oErr } = await supabase
        .from('sale_orders')
        .select(
          'id, order_number, location_id, locations(id, name, address), customers(id, address, company_name, primary_contact), sale_order_lines(id, item_id, quantity, unit_price)',
        )
        .eq('id', orderId)
        .returns<{
          id: string;
          order_number: string;
          location_id: string | null;
          locations: { id: string; name: string; address: string | null } | null;
          customers: {
            id: string;
            address: string | null;
            company_name: string | null;
            primary_contact: string;
          } | null;
          sale_order_lines: {
            id: string;
            item_id: string;
            quantity: number;
            unit_price: number;
          }[];
        }[]>()
        .single();

      if (oErr || !order) throw new Error('Failed to load order');
      if (!order.location_id) throw new Error('Order has no warehouse location set');

      for (const line of order.sale_order_lines) {
        await processStockMovement({
          userId,
          locationId: order.location_id,
          itemId: line.item_id,
          movementType: 'SALE_DISPATCH',
          quantity: line.quantity,
          unitCost: line.unit_price,
          referenceType: 'SALE_ORDER',
          referenceId: order.id,
          notes: `Sale dispatch: ${order.order_number}`,
          createdBy: userId,
        });
      }

      const { error: statusErr } = await supabase
        .from('sale_orders')
        .update({
          status: 'DISPATCHED',
          dispatched_at: new Date().toISOString(),
        })
        .eq('id', orderId);
      if (statusErr) throw new Error(statusErr.message);

      const challanNumber = await generateOrderNumber(userId, 'DC');
      const fromAddress =
        order.locations?.address ?? order.locations?.name ?? 'Warehouse';
      const toAddress =
        order.customers?.address ??
        order.customers?.company_name ??
        order.customers?.primary_contact ??
        'Customer';

      const { error: challanErr } = await supabase.from('delivery_challans').insert({
        user_id: userId,
        challan_number: challanNumber,
        sale_order_id: order.id,
        from_address: fromAddress,
        to_address: toAddress,
        status: 'DRAFT',
        generated_at: new Date().toISOString(),
      });
      if (challanErr) throw new Error(challanErr.message);

      await writeAuditLog({
        userId,
        action: 'UPDATE',
        entityType: 'sale_order',
        entityId: orderId,
        oldValues: { status: 'CONFIRMED' },
        newValues: {
          status: 'DISPATCHED',
          challan_number: challanNumber,
          line_count: order.sale_order_lines.length,
        },
      });
    },
    onSuccess: () => {
      toast.success('Order dispatched — inventory deducted');
      if (userId) {
        void insertNotification({
          userId,
          type: 'SO_DISPATCHED',
          title: 'Sale order dispatched',
          body: 'Inventory deducted and delivery challan drafted',
          link: '/dashboard/sales',
        });
      }
      void queryClient.invalidateQueries({ queryKey: ['sale_orders'] });
      void queryClient.invalidateQueries({ queryKey: ['items'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      void queryClient.invalidateQueries({ queryKey: ['low-stock'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-ledger'] });
      void queryClient.invalidateQueries({ queryKey: ['delivery_challans'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deliverMutation = useMutation({
    mutationFn: async (orderId: string) => {
      if (!userId) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('sale_orders')
        .update({
          status: 'DELIVERED',
          delivered_at: new Date().toISOString(),
        })
        .eq('id', orderId);
      if (error) throw new Error(error.message);

      await writeAuditLog({
        userId,
        action: 'UPDATE',
        entityType: 'sale_order',
        entityId: orderId,
        oldValues: { status: 'DISPATCHED' },
        newValues: { status: 'DELIVERED' },
      });
    },
    onSuccess: () => {
      toast.success('Order marked as delivered');
      void queryClient.invalidateQueries({ queryKey: ['sale_orders'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const cancelMutation = useMutation({
    mutationFn: async (orderId: string) => {
      if (!userId) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('sale_orders')
        .update({ status: 'CANCELLED' })
        .eq('id', orderId);
      if (error) throw new Error(error.message);

      await writeAuditLog({
        userId,
        action: 'REJECT',
        entityType: 'sale_order',
        entityId: orderId,
        newValues: { status: 'CANCELLED' },
      });
    },
    onSuccess: () => {
      toast.success('Order cancelled');
      void queryClient.invalidateQueries({ queryKey: ['sale_orders'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async ({
      orderId,
      currentAmountPaid,
      totalAmount,
      orderStatus,
      values,
    }: {
      orderId: string;
      currentAmountPaid: number;
      totalAmount: number;
      orderStatus: string;
      values: PaymentFormValues;
    }) => {
      if (!userId) throw new Error('Not authenticated');

      const { data: payment, error: payErr } = await supabase.from('payments').insert({
        user_id: userId,
        sale_order_id: orderId,
        amount: values.amount,
        mode: values.mode,
        reference_no: values.reference_no.trim() || null,
        notes: values.notes.trim() || null,
        received_by: userId,
        received_at: new Date().toISOString(),
      }).select('id').single();
      if (payErr) throw new Error(payErr.message);

      const newAmountPaid = currentAmountPaid + values.amount;
      const paymentStatus = calcPaymentStatus(
        newAmountPaid,
        totalAmount,
        orderStatus,
      );

      const { error: orderErr } = await supabase
        .from('sale_orders')
        .update({
          amount_paid: newAmountPaid,
          payment_status: paymentStatus,
        })
        .eq('id', orderId);
      if (orderErr) throw new Error(orderErr.message);

      await writeAuditLog({
        userId,
        action: 'CREATE',
        entityType: 'payment',
        entityId: payment.id,
        newValues: {
          sale_order_id: orderId,
          amount: values.amount,
          mode: values.mode,
          payment_status: paymentStatus,
          amount_paid: newAmountPaid,
        },
      });
    },
    onSuccess: () => {
      toast.success('Payment recorded');
      void queryClient.invalidateQueries({ queryKey: ['sale_orders'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const isTransitioning =
    confirmMutation.isPending ||
    dispatchMutation.isPending ||
    deliverMutation.isPending ||
    cancelMutation.isPending;

  const executeConfirmAction = useCallback(() => {
    if (!confirmAction) return;
    const { orderId, action } = confirmAction;
    switch (action) {
      case 'confirm':
        confirmMutation.mutate(orderId);
        break;
      case 'dispatch':
        dispatchMutation.mutate(orderId);
        break;
      case 'deliver':
        deliverMutation.mutate(orderId);
        break;
      case 'cancel':
        cancelMutation.mutate(orderId);
        break;
    }
    setConfirmAction(null);
  }, [confirmAction, confirmMutation, dispatchMutation, deliverMutation, cancelMutation]);

  // ── Form ─────────────────────────────────────────────────

  const form = useForm<SaleOrderFormValues>({
    resolver: zodResolver(saleOrderSchema),
    defaultValues: {
      customer_id: '',
      location_id: '',
      notes: '',
      lines: [{ item_id: '', quantity: 1, unit_price: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'lines',
  });

  const watchedLines = form.watch('lines');
  const grandTotal = watchedLines.reduce(
    (sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0),
    0,
  );

  const onSubmit: SubmitHandler<SaleOrderFormValues> = (values) => {
    createMutation.mutate(values);
  };

  const openCreateModal = useCallback(() => {
    form.reset({
      customer_id: '',
      location_id: '',
      notes: '',
      lines: [{ item_id: '', quantity: 1, unit_price: 0 }],
    });
    setShowCreate(true);
  }, [form]);

  // ── Render ───────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Sales Orders"
        description={`${totalCount} order${totalCount !== 1 ? 's' : ''} found`}
        actions={<Button onClick={openCreateModal}><Plus size={16} />New Sale Order</Button>}
      />

      {/* Search + status tabs */}
      <SearchToolbar value={search} onChange={setSearch} placeholder="Search order # or customer…">
        <div className="flex flex-wrap gap-2">
          {ORDER_STATUS_TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setStatusTab(t)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                statusTab === t
                  ? 'bg-primary text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted'
              }`}
            >
              {t === 'ALL' ? 'All' : t.charAt(0) + t.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </SearchToolbar>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded bg-muted"
              />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No sale orders yet"
            description="Create your first sale order to get started."
            action={<Button onClick={openCreateModal}><Plus className="h-4 w-4" />Create first order</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-border bg-muted text-xs font-medium uppercase text-muted-foreground">
                <tr>
                  <th className="w-8 px-3 py-3" />
                  <th className="px-4 py-3">Order #</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((order) => {
                  const isOpen = expanded.has(order.id);
                  return (
                    <OrderTableRow
                      key={order.id}
                      order={order}
                      isOpen={isOpen}
                      isTransitioning={isTransitioning}
                      isRecordingPayment={recordPaymentMutation.isPending}
                      onToggle={() => toggleExpand(order.id)}
                      onAction={(action) =>
                        setConfirmAction({
                          orderId: order.id,
                          orderNumber: order.order_number,
                          action,
                        })
                      }
                      onRecordPayment={async (values) => {
                        await recordPaymentMutation.mutateAsync({
                          orderId: order.id,
                          currentAmountPaid: order.amount_paid,
                          totalAmount: order.total_amount,
                          orderStatus: order.status,
                          values,
                        });
                      }}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

      {/* ── Create order modal ──────────────────────────── */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-16"
          role="presentation"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="w-full max-w-2xl rounded-xl bg-card p-6 shadow-2xl"
            role="dialog"
            aria-label="Create Sale Order"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                New Sale Order
              </h2>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {/* Customer + Location */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Customer *
                  </label>
                  <select
                    {...form.register('customer_id')}
                    className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Select customer…</option>
                    {(customers ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company_name ?? c.primary_contact} ({c.customer_id_display})
                      </option>
                    ))}
                  </select>
                  {form.formState.errors.customer_id && (
                    <p className="mt-1 text-xs text-red-600">
                      {form.formState.errors.customer_id.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Location / Warehouse *
                  </label>
                  <select
                    {...form.register('location_id')}
                    className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Select location…</option>
                    {(locations ?? []).map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                  {form.formState.errors.location_id && (
                    <p className="mt-1 text-xs text-red-600">
                      {form.formState.errors.location_id.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Line items */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">
                    Line Items *
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      append({ item_id: '', quantity: 1, unit_price: 0 })
                    }
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
                  >
                    <Plus size={14} /> Add line
                  </button>
                </div>

                {form.formState.errors.lines?.root && (
                  <p className="mb-2 text-xs text-red-600">
                    {form.formState.errors.lines.root.message}
                  </p>
                )}

                <div className="space-y-3">
                  {fields.map((field, idx) => {
                    const lineQty = Number(watchedLines[idx]?.quantity) || 0;
                    const linePrice = Number(watchedLines[idx]?.unit_price) || 0;
                    const lineTotal = lineQty * linePrice;

                    return (
                      <div
                        key={field.id}
                        className="grid grid-cols-[1fr_80px_100px_90px_32px] items-end gap-2 rounded-md border border-border bg-muted p-3"
                      >
                        <div>
                          <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
                            Item
                          </label>
                          <select
                            {...form.register(`lines.${idx}.item_id`)}
                            className="w-full rounded border border-border bg-card px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <option value="">Select…</option>
                            {(items ?? []).map((it) => (
                              <option key={it.id} value={it.id}>
                                {it.standardized_name} ({it.product_code})
                              </option>
                            ))}
                          </select>
                          {form.formState.errors.lines?.[idx]?.item_id && (
                            <p className="mt-0.5 text-[10px] text-red-600">
                              {form.formState.errors.lines[idx]?.item_id?.message}
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
                            Qty
                          </label>
                          <input
                            type="number"
                            min={1}
                            step={1}
                            {...form.register(`lines.${idx}.quantity`, {
                              valueAsNumber: true,
                            })}
                            className="w-full rounded border border-border bg-card px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
                            Unit price (₹)
                          </label>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            {...form.register(`lines.${idx}.unit_price`, {
                              valueAsNumber: true,
                            })}
                            className="w-full rounded border border-border bg-card px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </div>

                        <div className="pb-1.5 text-right text-sm font-medium text-foreground">
                          {formatCurrency(lineTotal)}
                        </div>

                        <button
                          type="button"
                          onClick={() => fields.length > 1 && remove(idx)}
                          disabled={fields.length <= 1}
                          className="mb-1 text-red-400 hover:text-red-600 disabled:opacity-30"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 text-right text-sm font-semibold text-foreground">
                  Grand total: {formatCurrency(grandTotal)}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Notes
                </label>
                <textarea
                  {...form.register('notes')}
                  rows={2}
                  className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Optional notes…"
                />
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary/90 disabled:opacity-60"
                >
                  {createMutation.isPending && (
                    <Loader2 size={15} className="animate-spin" />
                  )}
                  Create Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Confirm action dialog ───────────────────────── */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-w-sm rounded-lg bg-card p-6 shadow-xl">
            <p className="text-foreground">
              {confirmAction.action === 'confirm' &&
                `Confirm order ${confirmAction.orderNumber}?`}
              {confirmAction.action === 'dispatch' &&
                `Dispatch order ${confirmAction.orderNumber}? This will deduct inventory at the assigned location.`}
              {confirmAction.action === 'deliver' &&
                `Mark order ${confirmAction.orderNumber} as delivered?`}
              {confirmAction.action === 'cancel' &&
                `Cancel order ${confirmAction.orderNumber}? This cannot be undone.`}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground"
              >
                Back
              </button>
              <button
                type="button"
                disabled={isTransitioning}
                onClick={executeConfirmAction}
                className={`inline-flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60 ${
                  confirmAction.action === 'cancel'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-primary hover:bg-primary/90'
                }`}
              >
                {isTransitioning && (
                  <Loader2 size={14} className="animate-spin" />
                )}
                {confirmAction.action === 'confirm' && 'Confirm'}
                {confirmAction.action === 'dispatch' && 'Dispatch'}
                {confirmAction.action === 'deliver' && 'Deliver'}
                {confirmAction.action === 'cancel' && 'Cancel Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Extracted row component ─────────────────────────────────

interface OrderTableRowProps {
  order: SaleOrderRow;
  isOpen: boolean;
  isTransitioning: boolean;
  isRecordingPayment: boolean;
  onToggle: () => void;
  onAction: (action: 'confirm' | 'dispatch' | 'deliver' | 'cancel') => void;
  onRecordPayment: (values: PaymentFormValues) => Promise<void>;
}

function OrderTableRow({
  order,
  isOpen,
  isTransitioning,
  isRecordingPayment,
  onToggle,
  onAction,
  onRecordPayment,
}: OrderTableRowProps) {
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  const paymentForm = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: Math.max(0, order.total_amount - order.amount_paid),
      mode: 'CASH',
      reference_no: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (showPaymentForm) {
      paymentForm.reset({
        amount: Math.max(0, order.total_amount - order.amount_paid),
        mode: 'CASH',
        reference_no: '',
        notes: '',
      });
    }
  }, [showPaymentForm, order.total_amount, order.amount_paid, paymentForm]);

  const balanceDue = Math.max(0, order.total_amount - order.amount_paid);
  const canRecordPayment =
    order.status !== 'CANCELLED' && balanceDue > 0;
  const lines = order.sale_order_lines;
  const canConfirm = order.status === 'DRAFT';
  const canDispatch =
    order.status === 'CONFIRMED' || order.status === 'PROCESSING';
  const canDeliver = order.status === 'DISPATCHED';
  const canCancel =
    order.status === 'DRAFT' || order.status === 'CONFIRMED';

  return (
    <>
      <tr className="border-b border-border/70 last:border-0 hover:bg-muted/40">
        <td className="px-3 py-3">
          <button
            type="button"
            onClick={onToggle}
            className="text-muted-foreground hover:text-foreground"
            aria-label={isOpen ? 'Collapse' : 'Expand'}
          >
            {isOpen ? (
              <ChevronDown size={16} />
            ) : (
              <ChevronRight size={16} />
            )}
          </button>
        </td>
        <td className="px-4 py-3 font-medium text-foreground">
          {order.order_number}
        </td>
        <td className="px-4 py-3 text-foreground">
          {customerLabel(order.customers)}
        </td>
        <td className="px-4 py-3 text-muted-foreground">
          {new Date(order.created_at).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </td>
        <td className="px-4 py-3 text-foreground">
          {order.locations?.name ?? '—'}
        </td>
        <td className="px-4 py-3 text-right font-medium text-foreground">
          {formatCurrency(order.total_amount)}
        </td>
        <td className="px-4 py-3">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${payBadge(order.payment_status)}`}
          >
            {order.payment_status}
          </span>
        </td>
        <td className="px-4 py-3">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(order.status)}`}
          >
            {order.status}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1.5">
            {canConfirm && (
              <ActionBtn
                label="Confirm"
                color="blue"
                disabled={isTransitioning}
                onClick={() => onAction('confirm')}
              />
            )}
            {canDispatch && (
              <ActionBtn
                label="Dispatch"
                color="amber"
                disabled={isTransitioning}
                onClick={() => onAction('dispatch')}
              />
            )}
            {canDeliver && (
              <ActionBtn
                label="Deliver"
                color="green"
                disabled={isTransitioning}
                onClick={() => onAction('deliver')}
              />
            )}
            {canCancel && (
              <ActionBtn
                label="Cancel"
                color="red"
                disabled={isTransitioning}
                onClick={() => onAction('cancel')}
              />
            )}
          </div>
        </td>
      </tr>

      {/* Expanded line items */}
      {isOpen && (
        <tr className="border-b border-border/70">
          <td colSpan={9} className="bg-muted/40 px-6 py-4">
            {lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">No line items.</p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] font-medium uppercase text-muted-foreground">
                  <tr>
                    <th className="pb-2 pr-4">Item</th>
                    <th className="pb-2 pr-4">Code</th>
                    <th className="pb-2 pr-4 text-right">Qty</th>
                    <th className="pb-2 pr-4 text-right">Unit Price</th>
                    <th className="pb-2 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.id} className="border-t border-border">
                      <td className="py-2 pr-4 text-foreground">
                        {line.items?.standardized_name ?? '—'}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {line.items?.product_code ?? '—'}
                      </td>
                      <td className="py-2 pr-4 text-right text-foreground">
                        {line.quantity}
                      </td>
                      <td className="py-2 pr-4 text-right text-foreground">
                        {formatCurrency(line.unit_price)}
                      </td>
                      <td className="py-2 text-right font-medium text-foreground">
                        {formatCurrency(line.total_price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
              <div className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Paid:</span>{' '}
                {formatCurrency(order.amount_paid)}{' '}
                <span className="text-muted-foreground">of</span>{' '}
                {formatCurrency(order.total_amount)}
                {balanceDue > 0 && (
                  <>
                    {' '}
                    ·{' '}
                    <span className="font-medium text-amber-700">
                      Balance: {formatCurrency(balanceDue)}
                    </span>
                  </>
                )}
              </div>
              {canRecordPayment && (
                <button
                  type="button"
                  onClick={() => setShowPaymentForm((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                >
                  <Banknote size={14} />
                  Record Payment
                </button>
              )}
            </div>

            {showPaymentForm && canRecordPayment && (
              <form
                onSubmit={paymentForm.handleSubmit(async (values) => {
                  try {
                    await onRecordPayment(values);
                    setShowPaymentForm(false);
                  } catch {
                    // toast handled by mutation
                  }
                })}
                className="mt-3 rounded-md border border-border bg-card p-4"
              >
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Record Payment
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
                      Amount (₹) *
                    </label>
                    <input
                      type="number"
                      min={0.01}
                      step={0.01}
                      {...paymentForm.register('amount', { valueAsNumber: true })}
                      className="w-full rounded border border-border bg-muted px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    {paymentForm.formState.errors.amount && (
                      <p className="mt-0.5 text-[10px] text-red-600">
                        {paymentForm.formState.errors.amount.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
                      Mode *
                    </label>
                    <select
                      {...paymentForm.register('mode')}
                      className="w-full rounded border border-border bg-muted px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {PAYMENT_MODES.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
                      Reference No.
                    </label>
                    <input
                      type="text"
                      {...paymentForm.register('reference_no')}
                      placeholder="Txn / cheque no."
                      className="w-full rounded border border-border bg-muted px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
                      Notes
                    </label>
                    <input
                      type="text"
                      {...paymentForm.register('notes')}
                      placeholder="Optional"
                      className="w-full rounded border border-border bg-muted px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPaymentForm(false)}
                    className="rounded border border-border px-3 py-1.5 text-xs text-muted-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isRecordingPayment}
                    className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {isRecordingPayment && (
                      <Loader2 size={13} className="animate-spin" />
                    )}
                    Save Payment
                  </button>
                </div>
              </form>
            )}

            {order.notes && (
              <p className="mt-3 text-xs text-muted-foreground">
                <span className="font-medium text-muted-foreground">Notes:</span>{' '}
                {order.notes}
              </p>
            )}

            {order.dispatched_at && (
              <p className="mt-1 text-xs text-muted-foreground">
                <span className="font-medium text-muted-foreground">Dispatched:</span>{' '}
                {new Date(order.dispatched_at).toLocaleString('en-IN')}
              </p>
            )}
            {order.delivered_at && (
              <p className="mt-1 text-xs text-muted-foreground">
                <span className="font-medium text-muted-foreground">Delivered:</span>{' '}
                {new Date(order.delivered_at).toLocaleString('en-IN')}
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ── Small action button ─────────────────────────────────────

interface ActionBtnProps {
  label: string;
  color: 'blue' | 'amber' | 'green' | 'red';
  disabled: boolean;
  onClick: () => void;
}

const COLOR_MAP: Record<ActionBtnProps['color'], string> = {
  blue: 'border-blue-300 text-blue-700 hover:bg-blue-50',
  amber: 'border-amber-300 text-amber-700 hover:bg-amber-50',
  green: 'border-emerald-300 text-emerald-700 hover:bg-emerald-50',
  red: 'border-red-300 text-red-600 hover:bg-red-50',
};

function ActionBtn({ label, color, disabled, onClick }: ActionBtnProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded border px-2 py-0.5 text-[11px] font-medium disabled:opacity-40 ${COLOR_MAP[color]}`}
    >
      {label}
    </button>
  );
}
