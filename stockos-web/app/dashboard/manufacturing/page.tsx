import { redirect } from 'next/navigation';

/** Manufacturing was renamed to Production Orders in Week 3 — keep the old URL working. */
export default function ManufacturingPage() {
  redirect('/dashboard/production');
}
