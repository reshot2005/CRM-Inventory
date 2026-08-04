import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { DashboardHomeClient } from '@/components/dashboard/DashboardHomeClient';
import type { DashboardKpis } from '@/lib/types/inventory';

export default async function DashboardPage() {
  const queryClient = new QueryClient();
  const supabase = createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.user?.id) {
    const userId = session.user.id;
    try {
      const { data } = await supabase.rpc('get_dashboard_kpis', {
        p_user_id: userId,
      });
      if (data) {
        await queryClient.prefetchQuery({
          queryKey: ['dashboard-kpis', userId],
          queryFn: async () => data as unknown as DashboardKpis,
        });
      }
    } catch {
      // Client will fetch
    }
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardHomeClient />
    </HydrationBoundary>
  );
}
