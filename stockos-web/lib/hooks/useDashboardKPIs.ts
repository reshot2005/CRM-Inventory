'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { DashboardKpis } from '@/lib/types/inventory';

export function useDashboardKPIs(userId: string | null) {
  return useQuery({
    queryKey: ['dashboard-kpis', userId ?? ''],
    queryFn: async (): Promise<DashboardKpis> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('get_dashboard_kpis', {
        p_user_id: userId!,
      });
      if (error) throw error;
      return data as unknown as DashboardKpis;
    },
    staleTime: 30_000,
    enabled: !!userId,
  });
}
