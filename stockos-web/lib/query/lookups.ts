import { createClient } from '@/lib/supabase/client';

export const LOOKUP_KEYS = {
  items: ['lookups', 'items'] as const,
  locations: ['lookups', 'locations'] as const,
  vendors: ['lookups', 'vendors'] as const,
  customers: ['lookups', 'customers'] as const,
};

export async function fetchLookupItems() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('items')
    .select('id, standardized_name, product_code, category, is_active')
    .eq('is_active', true)
    .order('standardized_name')
    .limit(500);
  if (error) throw error;
  return data ?? [];
}

export async function fetchLookupLocations() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('locations')
    .select('id, name, code, is_active')
    .eq('is_active', true)
    .order('name')
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function fetchLookupVendors() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('vendors')
    .select('id, name, is_active')
    .eq('is_active', true)
    .order('name')
    .limit(300);
  if (error) throw error;
  return data ?? [];
}

export async function fetchLookupCustomers() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('customers')
    .select('id, name, is_active')
    .eq('is_active', true)
    .order('name')
    .limit(300);
  if (error) throw error;
  return data ?? [];
}
