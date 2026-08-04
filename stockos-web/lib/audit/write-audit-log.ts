import { createClient } from '@/lib/supabase/client';
import type { Json } from '@/lib/supabase/database.types';

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'APPROVE'
  | 'REJECT'
  | 'LOGIN'
  | 'LOGOUT';

export type WriteAuditLogParams = {
  userId: string;
  /** When omitted, resolved via get_user_org_id(). */
  orgId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
};

/**
 * Append-only audit write. Never throws — mutations must not fail because of audit.
 */
export async function writeAuditLog(params: WriteAuditLogParams): Promise<void> {
  try {
    const supabase = createClient();
    let orgId = params.orgId ?? null;
    if (!orgId) {
      const { data, error } = await supabase.rpc('get_user_org_id');
      if (error) {
        console.warn('audit_logs skipped (org):', error.message);
        return;
      }
      orgId = (data as string | null) ?? null;
    }
    if (!orgId) {
      console.warn('audit_logs skipped: no org_id');
      return;
    }

    const { error } = await supabase.from('audit_logs').insert({
      user_id: params.userId,
      org_id: orgId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      old_values: (params.oldValues ?? null) as Json | null,
      new_values: (params.newValues ?? null) as Json | null,
    });
    if (error) {
      console.warn('audit_logs insert skipped:', error.message);
    }
  } catch (e) {
    console.warn(
      'audit_logs insert skipped:',
      e instanceof Error ? e.message : String(e),
    );
  }
}
