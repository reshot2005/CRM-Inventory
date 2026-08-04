import { config } from 'dotenv';
import { join } from 'path';

/** stockos-api/.env — must run before @prisma/client so DATABASE_URL is correct when cwd is repo root. */
config({ path: join(__dirname, '..', '.env') });
