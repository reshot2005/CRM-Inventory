import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().optional().default('3001'),
  NODE_ENV: z
    .enum(['development', 'production', 'test', 'staging'])
    .optional()
    .default('development'),
  FRONTEND_URL: z.string().url().optional().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
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
});

export type EnvConfig = z.infer<typeof envSchema>;

export interface AppConfig {
  port: number;
  nodeEnv: string;
  frontendUrl: string;
  database: {
    url: string;
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
    database: {
      url: env.DATABASE_URL,
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
  };
});
