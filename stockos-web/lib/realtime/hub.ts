'use client';

import { queryClient } from '@/lib/query-client';
import { createClient } from '@/lib/supabase/client';

type Listener = (table: string) => void;

const TABLE_TO_KEYS: Record<string, string[][]> = {
  items: [['items'], ['lookups', 'items'], ['dashboard']],
  inventory: [['inventory'], ['layout-low-stock'], ['dashboard']],
  locations: [['locations'], ['lookups', 'locations']],
  vendors: [['vendors'], ['lookups', 'vendors']],
  customers: [['customers'], ['lookups', 'customers']],
  move_orders: [['move_orders'], ['layout-pending-moves']],
  purchase_orders: [['purchase_orders'], ['dashboard']],
  sale_orders: [['sale_orders'], ['dashboard']],
  stock_ledger: [['stock_ledger'], ['dashboard']],
  boms: [['boms']],
  production_orders: [['production_orders']],
  wip_stage_templates: [['wip_stage_templates']],
  wip_tracking: [['wip_tracking']],
  machines: [['machines']],
  invoices: [['invoices']],
  delivery_challans: [['challans'], ['delivery_challans']],
  labour_workers: [['labour']],
  qa_templates: [['qa']],
  qa_reports: [['qa']],
};

class RealtimeHub {
  private supabase = createClient();
  private channel: ReturnType<typeof this.supabase.channel> | null = null;
  private tables = new Set<string>();
  private refCounts = new Map<string, number>();
  private listeners = new Set<Listener>();

  subscribe(table: string): () => void {
    const next = (this.refCounts.get(table) ?? 0) + 1;
    this.refCounts.set(table, next);
    this.tables.add(table);
    this.ensureChannel();

    return () => {
      const count = (this.refCounts.get(table) ?? 1) - 1;
      if (count <= 0) {
        this.refCounts.delete(table);
        this.tables.delete(table);
        this.rebuildChannel();
      } else {
        this.refCounts.set(table, count);
      }
    };
  }

  onInvalidate(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private ensureChannel() {
    if (this.channel) return;
    this.rebuildChannel();
  }

  private rebuildChannel() {
    if (this.channel) {
      void this.supabase.removeChannel(this.channel);
      this.channel = null;
    }
    if (this.tables.size === 0) return;

    let channel = this.supabase.channel('stockos-rt-hub');
    for (const table of Array.from(this.tables)) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => {
          this.invalidate(table);
          for (const listener of Array.from(this.listeners)) listener(table);
        },
      );
    }
    this.channel = channel.subscribe();
  }

  private invalidate(table: string) {
    const prefixes = TABLE_TO_KEYS[table] ?? [[table]];
    for (const prefix of prefixes) {
      void queryClient.invalidateQueries({ queryKey: prefix });
    }
  }
}

export const realtimeHub = new RealtimeHub();
