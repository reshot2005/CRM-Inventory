import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const envSchema = z
  .object({
    PORT: z.string().optional().default('3001'),
    NODE_ENV: z
      .enum(['development', 'production', 'test', 'staging'])
      .optional()
      .default('development'),
    FRONTEND_URL: z.string().url().optional().default('http://localhost:3000'),
    /** Comma-separated extra origins (e.g. Vercel preview/prod URLs) allowed by CORS */
    CORS_ORIGINS: z.string().optional(),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    DIRECT_DATABASE_URL: z.string().min(1).optional(),
    JWT_ACCESS_SECRET: z
      .string()
      .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: z
      .string()
      .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    JWT_ACCESS_EXPIRES: z.string().optional().default('15m'),
    JWT_REFRESH_EXPIRES: z.string().optional().default('7d'),
    REDIS_URL: z.string().optional().default('redis://localhost:6379'),
    BCRYPT_ROUNDS: z.string().optional().default('12'),
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_ANON_KEY: z.string().min(1).optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
    SUPABASE_JWT_SECRET: z.string().min(1).optional(),
    SUPABASE_WEBHOOK_SECRET: z.string().min(1).optional(),
    // When true (default), new users created via Supabase self-signup are ACTIVE immediately.
    // Set to "false" to require admin approval (PENDING) after email confirmation.
    SUPABASE_AUTO_APPROVE_SIGNUPS: z.string().optional().default('true'),
    CLOUDFLARE_ACCOUNT_ID: z.string().min(1).optional(),
    R2_ACCESS_KEY_ID: z.string().min(1).optional(),
    R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    R2_BUCKET_NAME: z.string().min(1).optional(),
    R2_PUBLIC_URL: z.string().url().optional(),
  })
  .refine(
    (data) => {
      if (data.SUPABASE_URL) {
        return !!(
          data.SUPABASE_SERVICE_ROLE_KEY &&
          data.SUPABASE_SERVICE_ROLE_KEY.trim().length > 0
        );
      }
      return true;
    },
    {
      message:
        'When SUPABASE_URL is set, SUPABASE_SERVICE_ROLE_KEY is required',
      path: ['SUPABASE_SERVICE_ROLE_KEY'],
    },
  )
  .refine(
    (data) => {
      if (!data.SUPABASE_URL || !data.SUPABASE_JWT_SECRET) return true;
      const s = data.SUPABASE_JWT_SECRET.trim().toLowerCase();
      const placeholders = [
        'your-supabase-jwt-secret',
        'changeme',
        'change-me',
        'secret',
        'paste_jwt_secret_from_supabase_dashboard_here',
      ];
      if (placeholders.includes(s) || s.startsWith('your-')) {
        return false;
      }
      return true;
    },
    {
      message:
        'SUPABASE_JWT_SECRET is still a placeholder. In Supabase Dashboard → Project Settings → API → JWT Settings, copy "JWT Secret" into stockos-api/.env (used to verify access tokens on POST /auth/sync).',
      path: ['SUPABASE_JWT_SECRET'],
    },
  );

export type EnvConfig = z.infer<typeof envSchema>;

export interface AppConfig {
  port: number;
  nodeEnv: string;
  frontendUrl: string;
  /** Raw comma-separated list from CORS_ORIGINS */
  corsOrigins: string;
  database: {
    url: string;
    directUrl?: string;
  };
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessExpires: string;
    refreshExpires: string;
  };
  redis: {
    url: string;
  };
  bcryptRounds: number;
  supabase: {
    url?: string;
    anonKey?: string;
    serviceRoleKey?: string;
    jwtSecret?: string;
    webhookSecret?: string;
    autoApproveSignups: boolean;
  };
  r2: {
    accountId?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    bucketName?: string;
    publicUrl?: string;
  };
}

export default registerAs('app', (): AppConfig => {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `\n❌ Invalid environment variables:\n${formatted}\n\nPlease check your .env file.\n`,
    );
  }

  const env = parsed.data;

  return {
    port: parseInt(env.PORT, 10),
    nodeEnv: env.NODE_ENV,
    frontendUrl: env.FRONTEND_URL,
    corsOrigins: env.CORS_ORIGINS ?? '',
    database: {
      url: env.DATABASE_URL,
      directUrl: env.DIRECT_DATABASE_URL,
    },
    jwt: {
      accessSecret: env.JWT_ACCESS_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
      accessExpires: env.JWT_ACCESS_EXPIRES,
      refreshExpires: env.JWT_REFRESH_EXPIRES,
    },
    redis: {
      url: env.REDIS_URL,
    },
    bcryptRounds: parseInt(env.BCRYPT_ROUNDS, 10),
    supabase: {
      url: env.SUPABASE_URL,
      anonKey: env.SUPABASE_ANON_KEY,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
      jwtSecret: env.SUPABASE_JWT_SECRET,
      webhookSecret: env.SUPABASE_WEBHOOK_SECRET,
      autoApproveSignups: env.SUPABASE_AUTO_APPROVE_SIGNUPS !== 'false',
    },
    r2: {
      accountId: env.CLOUDFLARE_ACCOUNT_ID,
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      bucketName: env.R2_BUCKET_NAME,
      publicUrl: env.R2_PUBLIC_URL,
    },
  };
});
