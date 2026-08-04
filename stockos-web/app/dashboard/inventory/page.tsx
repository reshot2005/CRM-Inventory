import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import InventoryPageClient from './InventoryPageClient';

const PAGE_SIZE = 20;

export default async function InventoryPage() {
  const queryClient = new QueryClient();
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data, count } = await supabase
      .from('items')
      .select(
        '*, inventory(quantity, reserved_qty, unit_cost, locations(name))',
        { count: 'exact' },
      )
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(0, PAGE_SIZE - 1);

    await queryClient.prefetchQuery({
      queryKey: ['items', user.id, 'ALL', '', 1],
      queryFn: async () => ({
        rows: data ?? [],
        total: count ?? 0,
      }),
    });
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <InventoryPageClient />
    </HydrationBoundary>
  );
}
