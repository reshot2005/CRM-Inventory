import { createPublicKey, type JsonWebKey } from 'crypto';

/** Supabase Auth user id (UUID v1–v8). */
export const SUPABASE_SUB_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeSupabaseUrl(url: string): string {
  return url.trim().replace(/\/$/, '');
}

export function supabaseAuthIssuer(url: string): string {
  return `${normalizeSupabaseUrl(url)}/auth/v1`;
}

export function isAudienceAuthenticated(aud: unknown): boolean {
  if (aud === 'authenticated') return true;
  if (Array.isArray(aud) && aud.includes('authenticated')) return true;
  return false;
}

/**
 * Heuristic for Supabase Auth **access** tokens (password/OAuth session).
 * Uses unverified payload only to choose verification key; signature is still checked.
 */
export function isSupabaseUserAccessPayload(
  payload: Record<string, unknown>,
  supabaseUrl: string | undefined,
): boolean {
  if (!supabaseUrl) return false;
  const expectedIss = supabaseAuthIssuer(supabaseUrl);
  const iss = payload['iss'];
  if (typeof iss !== 'string' || iss !== expectedIss) return false;
  const sub = payload['sub'];
  if (typeof sub !== 'string' || !SUPABASE_SUB_UUID.test(sub)) return false;
  if (payload['role'] === 'authenticated') return true;
  if (isAudienceAuthenticated(payload['aud'])) return true;
  return false;
}

interface JwksBody {
  keys?: JsonWebKey[];
}

let jwksCache: {
  baseUrl: string;
  kidToPem: Map<string, string>;
  fetchedAt: number;
} | null = null;

const JWKS_TTL_MS = 8 * 60 * 1000;

/**
 * EC/RSA public key as PEM for verifying ES256/RS256 Supabase Auth JWTs.
 */
export async function getSupabaseJwksPublicKeyPem(
  supabaseUrl: string,
  kid: string,
): Promise<string> {
  const baseUrl = normalizeSupabaseUrl(supabaseUrl);
  const now = Date.now();
  if (
    jwksCache &&
    jwksCache.baseUrl === baseUrl &&
    now - jwksCache.fetchedAt < JWKS_TTL_MS
  ) {
    const hit = jwksCache.kidToPem.get(kid);
    if (hit) return hit;
  }

  const jwksUrl = `${baseUrl}/auth/v1/.well-known/jwks.json`;
  const res = await fetch(jwksUrl);
  if (!res.ok) {
    throw new Error(
      `JWKS request failed (${res.status}). Is SUPABASE_URL correct? ${jwksUrl}`,
    );
  }
  const body = (await res.json()) as JwksBody;
  const keys = body.keys ?? [];
  const kidToPem = new Map<string, string>();
  for (const jwk of keys) {
    if (typeof jwk.kid !== 'string') continue;
    try {
      const pem = createPublicKey({ key: jwk, format: 'jwk' }).export({
        type: 'spki',
        format: 'pem',
      }) as string;
      kidToPem.set(jwk.kid, pem);
    } catch {
      /* skip malformed keys */
    }
  }
  jwksCache = { baseUrl, kidToPem, fetchedAt: now };
  const pem = kidToPem.get(kid);
  if (!pem) {
    throw new Error(
      `No JWKS key for kid "${kid}". If you rotated signing keys, wait ~10 minutes for cache or restart.`,
    );
  }
  return pem;
}
