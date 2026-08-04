'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { createClient, type Tables } from '@/lib/supabase/client';
import { useUserId } from '@/lib/hooks/useUserId';

type NotificationRow = Tables<'notifications'>;

export function NotificationBell() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', userId ?? ''],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
    staleTime: 15_000,
  });

  const unread = notifications.filter((n) => !n.is_read);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as NotificationRow;
          toast.info(row.title, {
            description: row.body ?? undefined,
            action: row.link
              ? {
                  label: 'Open',
                  onClick: () => {
                    window.location.href = row.link!;
                  },
                }
              : undefined,
          });
          void queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, supabase, queryClient]);

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
        .eq('user_id', userId!);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId!)
        .eq('is_read', false);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('All notifications marked read');
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Open notifications"
        onClick={() => setOpen((o) => !o)}
      >
        <Bell className="h-5 w-5" />
        {unread.length > 0 ? (
          <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        ) : null}
      </Button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-96 rounded-xl border border-border bg-card py-2 shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            {unread.length > 0 ? (
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline"
                onClick={() => markAllRead.mutate()}
              >
                Mark all read
              </button>
            ) : null}
          </div>
          <ul className="max-h-80 overflow-auto">
            {notifications.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                No notifications yet
              </li>
            ) : (
              notifications.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`w-full px-4 py-3 text-left text-sm hover:bg-muted/50 ${
                      n.is_read ? 'opacity-70' : 'bg-primary/5'
                    }`}
                    onClick={() => {
                      if (!n.is_read) markRead.mutate(n.id);
                      setOpen(false);
                      if (n.link) window.location.href = n.link;
                    }}
                  >
                    <p className="font-medium text-foreground">{n.title}</p>
                    {n.body ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
                    ) : null}
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {n.created_at
                        ? formatDistanceToNow(new Date(n.created_at), {
                            addSuffix: true,
                          })
                        : ''}
                      {n.type ? ` · ${n.type}` : ''}
                    </p>
                  </button>
                </li>
              ))
            )}
          </ul>
          <div className="border-t border-border px-4 py-2">
            <Link
              href="/dashboard/products?filter=lowstock"
              className="text-xs font-medium text-primary hover:underline"
              onClick={() => setOpen(false)}
            >
              View low stock products
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
