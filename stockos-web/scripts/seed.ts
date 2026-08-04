/**
 * CLI: npx tsx scripts/seed.ts <user_id>
 */
import fs from 'fs';
import path from 'path';
import { seedForUser } from '../lib/seed/seed-for-user';

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

async function main() {
  loadEnvLocal();
  const userId = process.argv[2];
  if (!userId) {
    console.error('Usage: npx tsx scripts/seed.ts <user_id>');
    process.exit(1);
  }
  const result = await seedForUser(userId);
  console.log(JSON.stringify(result, null, 2));
}

void main();
