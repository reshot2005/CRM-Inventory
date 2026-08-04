import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';

export function createSupabaseClient(
  configService: ConfigService,
): SupabaseClient | null {
  const url = configService.get<string>('app.supabase.url');
  const serviceRoleKey = configService.get<string>('app.supabase.serviceRoleKey');
  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export const SUPABASE_CLIENT = 'SUPABASE_CLIENT';
