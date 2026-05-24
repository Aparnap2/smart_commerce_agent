-- Migration 005: Add pricing audit columns to CatalogItem
-- Spec F14: Weekly catalog pricing audit for Finance dashboard
--
-- Run this against your database:
--   psql -U supabase_admin -d postgres -f migrations/005_add_pricing_flag_columns.sql
-- Or via Docker:
--   docker exec -i supabase-db psql -U supabase_admin -d postgres < migrations/005_add_pricing_flag_columns.sql

ALTER TABLE "CatalogItem"
    ADD COLUMN IF NOT EXISTS "pricingFlag" boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS "pricingFlaggedAt" timestamp(3),
    ADD COLUMN IF NOT EXISTS "marketMedianPrice" integer;

COMMENT ON COLUMN "CatalogItem"."pricingFlag" IS 'True when weekly audit finds unit_price > 115% of market median. Cleared when vendor updates price or procurement resolves.';
COMMENT ON COLUMN "CatalogItem"."pricingFlaggedAt" IS 'Timestamp of the most recent pricing audit flag.';
COMMENT ON COLUMN "CatalogItem"."marketMedianPrice" IS 'Median market price (in paise) from the most recent SerpApi lookup during pricing audit.';
