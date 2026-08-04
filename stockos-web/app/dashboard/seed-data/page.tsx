'use client';

import { useState } from 'react';
import { useUserId } from '@/lib/hooks/useUserId';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

/** DEV ONLY — remove before production. */
export default function SeedDataPage() {
  const userId = useUserId();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);

  async function runSeed() {
    if (!userId) {
      toast.error('Not signed in');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/dev/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Seed failed');
      setResult(json);
      toast.success('Seed data loaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Seed failed');
    } finally {
      setLoading(false);
    }
  }

  if (process.env.NODE_ENV === 'production') {
    return (
      <p className="text-sm text-muted-foreground">
        Seed route disabled in production.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 p-6">
      <h1 className="text-xl font-bold">Dev seed data</h1>
      <p className="text-sm text-muted-foreground">
        Loads Week 1 demo locations, items, stock (via process_stock_movement),
        vendors, and customers for your account.
      </p>
      <p className="font-mono text-xs">user: {userId ?? '—'}</p>
      <Button disabled={!userId || loading} onClick={() => void runSeed()}>
        {loading ? 'Seeding…' : 'Run seed'}
      </Button>
      {result ? (
        <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
