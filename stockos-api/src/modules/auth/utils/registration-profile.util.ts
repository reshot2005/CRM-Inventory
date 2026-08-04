/** Shape stored in Postgres + synced from Supabase `user_metadata` / webhook `raw_user_meta_data`. */
export type RegistrationProfile = {
  name: string;
  phone: string | null;
  companyName: string | null;
  jobTitle: string | null;
};

function pickTrimmed(
  meta: Record<string, unknown> | undefined,
  ...keys: string[]
): string | null {
  if (!meta) {
    return null;
  }
  for (const key of keys) {
    const v = meta[key];
    if (typeof v === 'string') {
      const t = v.trim();
      if (t.length > 0) {
        return t;
      }
    }
  }
  return null;
}

/**
 * Reads signup metadata from Supabase JWT `user_metadata` or DB webhook `raw_user_meta_data`.
 * Use snake_case keys in signUp `options.data` for consistency (`company_name`, `job_title`).
 */
export function registrationProfileFromMetadata(
  meta: Record<string, unknown> | undefined,
  email: string,
): RegistrationProfile {
  const name =
    pickTrimmed(meta, 'name', 'full_name') ??
    (email.includes('@') ? email.split('@')[0] : null) ??
    'Unknown';

  return {
    name,
    phone: pickTrimmed(meta, 'phone', 'phone_number'),
    companyName: pickTrimmed(meta, 'company_name', 'companyName'),
    jobTitle: pickTrimmed(meta, 'job_title', 'jobTitle'),
  };
}
