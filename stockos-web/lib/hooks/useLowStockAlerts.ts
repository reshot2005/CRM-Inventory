'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import type { LowStockItem } from '@/lib/types/inventory';
import { insertNotification } from '@/lib/stock/manufacturing';

export function useLowStockAlerts(userId?: string | null) {
  const queryClient = useQueryClient();
  const uid = userId ?? null;

  useEffect(() => {
    if (!uid) return;
    const supabase = createClient();
    const channel = supabase
      .channel('low-stock-monitor')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'inventory' },
        async (payload) => {
          const newRow = payload.new as {
            item_id: string;
            quantity: number;
            user_id: string;
          };
          if (newRow.user_id !== uid) return;

          const { data: item } = await supabase
            .from('items')
            .select('min_stock_level, standardized_name')
            .eq('id', newRow.item_id)
            .single();

          const minLevel = item?.min_stock_level ?? 0;
          if (item && minLevel > 0 && newRow.quantity <= minLevel) {
            toast.warning(
              `Low stock: ${item.standardized_name} — only ${newRow.quantity} remaining`,
              {
                duration: 8000,
                action: {
                  label: 'View',
                  onClick: () => {
                    window.location.href = '/dashboard/products?filter=lowstock';
                  },
                },
              },
            );
            void insertNotification({
              userId: uid,
              type: 'LOW_STOCK',
              title: `Low stock: ${item.standardized_name}`,
              body: `Only ${newRow.quantity} remaining (min ${minLevel})`,
              link: '/dashboard/products?filter=lowstock',
            });
            void queryClient.invalidateQueries({ queryKey: ['low-stock'] });
            void queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
            void queryClient.invalidateQueries({ queryKey: ['notifications'] });
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [uid, queryClient]);

  return useQuery({
    queryKey: ['low-stock', uid ?? ''],
    queryFn: async (): Promise<LowStockItem[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('get_low_stock_items', {
        p_user_id: uid!,
      });
      if (error) throw error;
      return (data ?? []) as LowStockItem[];
    },
    enabled: !!uid,
  });
}
