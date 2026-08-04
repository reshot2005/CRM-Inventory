'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useEffect } from 'react';
import { realtimeHub } from '@/lib/realtime/hub';

export function useRealtimeQuery<T>(
  queryKey: readonly unknown[],
  table: string,
  queryFn: () => Promise<T>,
  enabled = true,
): UseQueryResult<T> {
  useEffect(() => {
    if (!enabled) return;
    return realtimeHub.subscribe(table);
  }, [table, enabled]);

  return useQuery({
    queryKey: [...queryKey],
    queryFn,
    enabled,
    staleTime: 60_000,
  });
}
