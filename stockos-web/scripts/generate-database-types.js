const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const TABLES = [
  'organizations','organization_members','organization_invites',
  'profiles','locations','items','inventory','stock_ledger','stock_adjustments',
  'move_orders','move_order_lines','vendors','vendor_contacts','vendor_items',
  'purchase_orders','purchase_order_lines','customers','customer_contacts',
  'customer_activities','sale_orders','sale_order_lines','payments',
  'delivery_challans','boms','bom_lines','production_orders',
  'production_material_lines','documents','audit_logs',
  'machines','batches','labour_entries','notifications',
];

function loadLocalEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

function pgToTs(dataType, udtName, isNullable) {
  let base = 'string';
  if (dataType === 'uuid' || dataType === 'text' || dataType === 'character varying' || dataType === 'inet') {
    base = 'string';
  } else if (dataType === 'boolean') {
    base = 'boolean';
  } else if (
    dataType === 'integer' ||
    dataType === 'bigint' ||
    dataType === 'smallint' ||
    dataType === 'numeric' ||
    dataType === 'double precision' ||
    dataType === 'real'
  ) {
    base = 'number';
  } else if (dataType.startsWith('timestamp') || dataType === 'date') {
    base = 'string';
  } else if (dataType === 'jsonb' || dataType === 'json') {
    base = 'Json';
  } else if (dataType === 'ARRAY') {
    if (udtName === '_text') base = 'string[]';
    else base = 'unknown[]';
  } else if (dataType === 'USER-DEFINED') {
    base = 'string';
  }
  return isNullable === 'YES' ? `${base} | null` : base;
}

async function main() {
  loadLocalEnv();
  if (!process.env.SUPABASE_DB_URL) {
    throw new Error('SUPABASE_DB_URL is required; database credentials must not be stored in scripts');
  }
  const client = new Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const { rows } = await client.query(
    `
    select table_name, column_name, data_type, udt_name, is_nullable, column_default
    from information_schema.columns
    where table_schema = 'public' and table_name = any($1::text[])
    order by table_name, ordinal_position
  `,
    [TABLES],
  );

  const byTable = {};
  for (const r of rows) {
    (byTable[r.table_name] ||= []).push(r);
  }

  let out = `export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
`;

  for (const table of TABLES) {
    const cols = byTable[table] || [];
    out += `      ${table}: {\n        Row: {\n`;
    for (const c of cols) {
      out += `          ${c.column_name}: ${pgToTs(c.data_type, c.udt_name, c.is_nullable)}\n`;
    }
    out += `        }\n        Insert: {\n`;
    for (const c of cols) {
      const optional =
        c.is_nullable === 'YES' ||
        c.column_default != null ||
        c.column_name === 'id'
          ? '?'
          : '';
      out += `          ${c.column_name}${optional}: ${pgToTs(c.data_type, c.udt_name, c.is_nullable)}\n`;
    }
    out += `        }\n        Update: {\n`;
    for (const c of cols) {
      out += `          ${c.column_name}?: ${pgToTs(c.data_type, c.udt_name, c.is_nullable)}\n`;
    }
    out += `        }\n        Relationships: []\n      }\n`;
  }

  out += `    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      process_stock_movement: {
        Args: {
          p_user_id: string
          p_location_id: string
          p_item_id: string
          p_movement_type: string
          p_quantity: number
          p_unit_cost?: number | null
          p_reference_type?: string | null
          p_reference_id?: string | null
          p_notes?: string | null
          p_created_by?: string | null
        }
        Returns: Json
      }
      get_dashboard_kpis: {
        Args: { p_user_id: string }
        Returns: Json
      }
      get_low_stock_items: {
        Args: { p_user_id: string }
        Returns: {
          item_id: string
          item_name: string
          product_code: string
          category: string
          location_id: string
          location_name: string
          current_qty: number
          min_stock_level: number
          deficit: number
        }[]
      }
      generate_order_number: {
        Args: { p_user_id: string; p_prefix: string }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
`;

  const target = path.join(__dirname, '..', 'lib', 'supabase', 'database.types.ts');
  fs.writeFileSync(target, out);
  console.log('Wrote', target);
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
