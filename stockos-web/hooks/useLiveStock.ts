'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface StockUpdate {
  locationId: string;
  itemId: string;
  quantity: number;
  reservedQty: number;
  unitCost: number;
  updatedAt: string;
}

export function useLiveStock(locationId?: string) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const [lastUpdate, setLastUpdate] = useState<StockUpdate | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel('inventory-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'inventory',
          ...(locationId
            ? { filter: `locationId=eq.${locationId}` }
            : {}),
        },
        (payload) => {
          const update = payload.new as StockUpdate;
          setLastUpdate(update);

          queryClient.invalidateQueries({
            queryKey: ['stock', update.itemId, update.locationId],
          });
          queryClient.invalidateQueries({ queryKey: ['reports', 'low-stock'] });
          queryClient.invalidateQueries({ queryKey: ['reports', 'dashboard'] });
          queryClient.invalidateQueries({
            queryKey: ['reports', 'dashboard-kpis'],
          });
          queryClient.invalidateQueries({ queryKey: ['items'] });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stock_ledger',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['ledger'] });
          queryClient.invalidateQueries({ queryKey: ['reports', 'ledger'] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [locationId, queryClient, supabase]);

  return { lastUpdate };
}

export function useLiveMoveOrders() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('move-order-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'move_orders' },
        () => {
          queryClient.invalidateQueries({
            queryKey: ['inventory', 'move-orders'],
          });
          queryClient.invalidateQueries({ queryKey: ['reports', 'dashboard'] });
          queryClient.invalidateQueries({
            queryKey: ['reports', 'dashboard-kpis'],
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, supabase]);
}
