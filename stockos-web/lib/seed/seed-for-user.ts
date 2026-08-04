import { createAdminClient } from '@/lib/supabase/admin';

export async function seedForUser(userId: string) {
  const supabase = createAdminClient();

  await supabase.from('profiles').upsert({
    id: userId,
    full_name: 'Seed Admin',
    company_name: 'StockOS Demo Factory',
    timezone: 'Asia/Kolkata',
  });

  const locations = [
    { code: 'FAC-001', name: 'Main Factory', type: 'FACTORY' as const },
    { code: 'HUB-MUM', name: 'Mumbai Hub', type: 'HUB' as const },
    { code: 'HUB-DEL', name: 'Delhi Hub', type: 'HUB' as const },
  ];

  const locationIds: Record<string, string> = {};
  for (const loc of locations) {
    const { data: existing } = await supabase
      .from('locations')
      .select('id')
      .eq('user_id', userId)
      .eq('code', loc.code)
      .maybeSingle();
    if (existing) {
      locationIds[loc.code] = existing.id;
      continue;
    }
    const { data, error } = await supabase
      .from('locations')
      .insert({
        user_id: userId,
        name: loc.name,
        code: loc.code,
        type: loc.type,
        is_active: true,
      })
      .select('id')
      .single();
    if (error) throw error;
    locationIds[loc.code] = data.id;
  }

  const factoryId = locationIds['FAC-001'];

  const itemsSpec = [
    { code: 'RAW-001', name: 'HDPE Granules', category: 'RAW_MATERIAL' as const, min: 500, unit: 'kg', cost: 125 },
    { code: 'RAW-002', name: 'PP Granules', category: 'RAW_MATERIAL' as const, min: 300, unit: 'kg', cost: 108 },
    { code: 'RAW-003', name: 'PVC Granules', category: 'RAW_MATERIAL' as const, min: 200, unit: 'kg', cost: 145 },
    { code: 'RAW-004', name: 'Master Batch Black', category: 'RAW_MATERIAL' as const, min: 50, unit: 'kg', cost: 210 },
    { code: 'PKG-001', name: 'PP Woven Sack 50kg', category: 'PACKAGING' as const, min: 500, unit: 'pcs', cost: 18 },
    { code: 'PKG-002', name: 'Corrugated Sheet B', category: 'PACKAGING' as const, min: 100, unit: 'pcs', cost: 45 },
    { code: 'PKG-003', name: 'Adhesive Label 100x50', category: 'PACKAGING' as const, min: 1000, unit: 'pcs', cost: 2 },
    { code: 'FG-001', name: 'HDPE Pipe 50mm', category: 'FINISHED_GOOD' as const, min: 100, unit: 'm', cost: 320 },
    { code: 'FG-002', name: 'PP Woven Bag 50kg', category: 'FINISHED_GOOD' as const, min: 500, unit: 'pcs', cost: 45 },
  ];

  const itemIds: Record<string, string> = {};
  for (const it of itemsSpec) {
    const { data: existing } = await supabase
      .from('items')
      .select('id')
      .eq('user_id', userId)
      .eq('product_code', it.code)
      .maybeSingle();
    if (existing) {
      itemIds[it.code] = existing.id;
      continue;
    }
    const { data, error } = await supabase
      .from('items')
      .insert({
        user_id: userId,
        standardized_name: it.name,
        product_code: it.code,
        category: it.category,
        unit: it.unit,
        min_stock_level: it.min,
        is_active: true,
      })
      .select('id')
      .single();
    if (error) throw error;
    itemIds[it.code] = data.id;
  }

  const stockLoads = [
    { code: 'RAW-001', qty: 2000, cost: 125 },
    { code: 'RAW-002', qty: 1500, cost: 108 },
    { code: 'RAW-003', qty: 800, cost: 145 },
    { code: 'RAW-004', qty: 120, cost: 210 },
    { code: 'PKG-001', qty: 2000, cost: 18 },
    { code: 'PKG-002', qty: 400, cost: 45 },
    { code: 'PKG-003', qty: 5000, cost: 2 },
    { code: 'FG-001', qty: 350, cost: 320 },
    { code: 'FG-002', qty: 1200, cost: 45 },
  ];

  for (const load of stockLoads) {
    const { data: inv } = await supabase
      .from('inventory')
      .select('quantity')
      .eq('user_id', userId)
      .eq('location_id', factoryId)
      .eq('item_id', itemIds[load.code])
      .maybeSingle();

    if (inv && Number(inv.quantity) > 0) {
      continue;
    }

    const { error } = await supabase.rpc('process_stock_movement', {
      p_user_id: userId,
      p_location_id: factoryId,
      p_item_id: itemIds[load.code],
      p_movement_type: 'IN',
      p_quantity: load.qty,
      p_unit_cost: load.cost,
      p_reference_type: 'MANUAL',
      p_notes: 'Week 1 seed stock',
      p_created_by: userId,
    });
    if (error) throw error;
  }

  const vendors = [
    { display: 'VEN-25-0001', name: 'Sharma Polymers', gstin: '27AABCS1429B1ZB' },
    { display: 'VEN-25-0002', name: 'PackRight Co', gstin: '29AABCP9021K1ZA' },
  ];
  for (const v of vendors) {
    const { data: existing } = await supabase
      .from('vendors')
      .select('id')
      .eq('user_id', userId)
      .eq('vendor_id_display', v.display)
      .maybeSingle();
    if (existing) continue;
    const { error } = await supabase.from('vendors').insert({
      user_id: userId,
      vendor_id_display: v.display,
      company_name: v.name,
      gstin: v.gstin,
      payment_terms: 'NET_30',
      is_active: true,
    });
    if (error) throw error;
  }

  const customers = [
    { display: 'CUS-25-0001', company: 'Acme Traders', contact: 'Ravi Mehta' },
    { display: 'CUS-25-0002', company: 'RetailX India', contact: 'Priya Shah' },
  ];
  for (const c of customers) {
    const { data: existing } = await supabase
      .from('customers')
      .select('id')
      .eq('user_id', userId)
      .eq('customer_id_display', c.display)
      .maybeSingle();
    if (existing) continue;
    const { error } = await supabase.from('customers').insert({
      user_id: userId,
      customer_id_display: c.display,
      type: 'BUSINESS',
      company_name: c.company,
      primary_contact: c.contact,
      payment_terms: 'NET_30',
      is_active: true,
    });
    if (error) throw error;
  }

  const { data: kpis } = await supabase.rpc('get_dashboard_kpis', {
    p_user_id: userId,
  });

  return {
    userId,
    locations: Object.keys(locationIds).length,
    items: Object.keys(itemIds).length,
    kpis,
  };
}
