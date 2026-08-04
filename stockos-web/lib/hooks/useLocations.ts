'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Tables } from '@/lib/supabase/client';

export type LocationRow = Tables<'locations'>;

export function useLocations(userId: string | null) {
  return useQuery({
    queryKey: ['locations', userId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('user_id', userId!)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}
