-- StockOS — Row Level Security (defense in depth for direct Supabase client usage).
-- The NestJS API uses the service role and bypasses RLS.
--
-- PREREQUISITE (required or you get: relation "users" does not exist)
-- Create all public.* tables FIRST using Prisma against this same database:
--   cd stockos-api
--   Set .env: DATABASE_URL (pooler :6543) + DIRECT_DATABASE_URL (:5432 for migrate)
--   npx prisma migrate deploy
--   npx prisma generate
-- Optional: confirm in SQL Editor:
--   SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1;

DO $guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'users'
  ) THEN
    RAISE EXCEPTION
      'public.users is missing. Run Prisma migrations first: cd stockos-api && npx prisma migrate deploy (DATABASE_URL must point at this Supabase project).';
  END IF;
END
$guard$;

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_ledger" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "move_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sale_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vendors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON "users" FOR SELECT
  USING (auth.uid()::text = "supabaseId");

CREATE POLICY "Admins can manage users"
  ON "users" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "users" u
      WHERE u."supabaseId" = auth.uid()::text
        AND u.role = 'ADMIN'
        AND u.status = 'ACTIVE'
    )
  );

CREATE POLICY "Users can read inventory for allowed locations"
  ON "inventory" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "users" u
      WHERE u."supabaseId" = auth.uid()::text
        AND u.status = 'ACTIVE'
        AND (
          u.role = 'ADMIN'
          OR u."allowedLocations" @> ARRAY["inventory"."locationId"]
          OR COALESCE(cardinality(u."allowedLocations"), 0) = 0
        )
    )
  );

CREATE POLICY "Active users can read items"
  ON "items" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "users"
      WHERE "supabaseId" = auth.uid()::text
        AND status = 'ACTIVE'
    )
  );

-- Realtime: enable in Dashboard or:
-- ALTER PUBLICATION supabase_realtime ADD TABLE "inventory";
-- ALTER PUBLICATION supabase_realtime ADD TABLE "stock_ledger";
-- ALTER PUBLICATION supabase_realtime ADD TABLE "move_orders";
-- ALTER PUBLICATION supabase_realtime ADD TABLE "sale_orders";
