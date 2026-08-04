-- Optional profile fields collected at Supabase signup and synced to app users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "companyName" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "jobTitle" TEXT;
