/**
 * @deprecated Nest R2 storage routes were removed in Week 4 (zero callers;
 * Prisma Document/Item shapes incompatible with live UUID schema).
 * Use Supabase Storage (see settings logo upload) for new uploads.
 */
export async function uploadItemImage(
  _itemId: string,
  _file: File,
  _options?: { onProgress?: (percent: number) => void },
): Promise<string> {
  throw new Error(
    'Nest R2 item upload was decommissioned. Use Supabase Storage for product images.',
  );
}

export async function uploadVendorDoc(
  _vendorId: string,
  _file: File,
): Promise<string> {
  throw new Error(
    'Nest R2 vendor upload was decommissioned. Use Supabase Storage.',
  );
}

export async function uploadCustomerDoc(
  _customerId: string,
  _file: File,
): Promise<string> {
  throw new Error(
    'Nest R2 customer upload was decommissioned. Use Supabase Storage.',
  );
}
