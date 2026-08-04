'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function ConfirmDialog({ open, onOpenChange, title = 'Confirm action', description, confirmLabel = 'Confirm', destructive, onConfirm, loading }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
}) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-md"><DialogHeader><div className={`mb-2 grid h-10 w-10 place-items-center rounded-full ${destructive ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}><AlertTriangle className="h-5 w-5" /></div><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant={destructive ? 'destructive' : 'default'} disabled={loading} onClick={onConfirm}>{loading ? 'Working…' : confirmLabel}</Button></DialogFooter></DialogContent></Dialog>;
}
