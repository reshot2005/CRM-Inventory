'use client';

import { PageHeader } from '@/components/ui/enterprise';

/** Week 3+ — tables not in Week 1 schema (batches/machines/labour/etc.). */
export default function Week3DeferredPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title={title} description={description} />
      <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          This module is deferred to Week 3+. The underlying tables are not part of the
          Week 1 Supabase schema. Inventory, purchasing, sales, and stock movements are
          fully live under Week 2.
        </p>
      </div>
    </div>
  );
}
