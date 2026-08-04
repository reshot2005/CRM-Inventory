export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'violet';

export interface StatusMeta {
  label: string;
  tone: StatusTone;
}

export const STATUS_CONFIG: Record<string, StatusMeta> = {
  ACTIVE: { label: 'Active', tone: 'success' },
  INACTIVE: { label: 'Inactive', tone: 'neutral' },
  DRAFT: { label: 'Draft', tone: 'neutral' },
  PENDING: { label: 'Pending', tone: 'warning' },
  APPROVED: { label: 'Approved', tone: 'info' },
  SENT: { label: 'Sent', tone: 'info' },
  CONFIRMED: { label: 'Confirmed', tone: 'info' },
  PROCESSING: { label: 'Processing', tone: 'violet' },
  IN_TRANSIT: { label: 'In transit', tone: 'info' },
  COMPLETED: { label: 'Completed', tone: 'success' },
  RECEIVED: { label: 'Received', tone: 'success' },
  DELIVERED: { label: 'Delivered', tone: 'success' },
  GENERATED: { label: 'Generated', tone: 'info' },
  PAID: { label: 'Paid', tone: 'success' },
  PARTIAL: { label: 'Partial', tone: 'warning' },
  UNPAID: { label: 'Unpaid', tone: 'warning' },
  OVERDUE: { label: 'Overdue', tone: 'danger' },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
  RETURNED: { label: 'Returned', tone: 'violet' },
  OUT_OF_STOCK: { label: 'Out of stock', tone: 'danger' },
  LOW_STOCK: { label: 'Low stock', tone: 'warning' },
  IN_STOCK: { label: 'In stock', tone: 'success' },
  OPERATIONAL: { label: 'Operational', tone: 'success' },
  MAINTENANCE: { label: 'Maintenance', tone: 'warning' },
  BREAKDOWN: { label: 'Breakdown', tone: 'danger' },
  RETIRED: { label: 'Retired', tone: 'neutral' },
  PASS: { label: 'Pass', tone: 'success' },
  FAIL: { label: 'Fail', tone: 'danger' },
  CONDITIONAL: { label: 'Conditional', tone: 'warning' },
  EXPIRED: { label: 'Expired', tone: 'danger' },
  QUARANTINE: { label: 'Quarantine', tone: 'violet' },
  PLANNED: { label: 'Planned', tone: 'neutral' },
  IN_PROGRESS: { label: 'In progress', tone: 'violet' },
  PAUSED: { label: 'Paused', tone: 'warning' },
  BLOCKED: { label: 'Blocked', tone: 'danger' },
  IDLE: { label: 'Idle', tone: 'neutral' },
  RUNNING: { label: 'Running', tone: 'violet' },
  DOWN: { label: 'Down', tone: 'danger' },
  PASSED: { label: 'Passed', tone: 'success' },
  FAILED: { label: 'Failed', tone: 'danger' },
  QUARANTINED: { label: 'Quarantined', tone: 'violet' },
};

export function getStatusMeta(status: string): StatusMeta {
  return STATUS_CONFIG[status] ?? {
    label: status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
    tone: 'neutral',
  };
}
