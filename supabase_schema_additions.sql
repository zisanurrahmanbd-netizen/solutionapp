/*
RecoveryCORE - Schema Additions (v2, safe to run multiple times)
HR/ERP modules + 24/7 agent location trail + bank contact fixes
HOW TO RUN: Supabase Dashboard -> SQL Editor -> New query
Clear the editor completely, paste ONLY the statements below, click Run.

NOTE: comments use block style so they survive copy-paste.
If you still get a syntax error, delete every comment line and run the rest.
*/

/* 1) HR & Operations records (Payroll, Attendance, Hiring, Growth, People, Inventory, Leave) */
CREATE TABLE IF NOT EXISTS hr_records (
  id BIGINT PRIMARY KEY,
  type TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_records_type ON hr_records(type);

/* 2) Agent location trail for 24/7 tracking (one row per GPS ping) */
CREATE TABLE IF NOT EXISTS location_pings (
  id BIGINT PRIMARY KEY DEFAULT (extract(epoch from now()) * 1000)::BIGINT,
  user_id BIGINT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  pinged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pings_user_time ON location_pings(user_id, pinged_at DESC);

/* 3) Realtime (skips silently if already added) */
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE hr_records;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE location_pings;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN others THEN NULL;
END $$;

/* 4) Row Level Security + permissive policies (skips silently if already created) */
ALTER TABLE hr_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_pings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Allow all access on hr_records" ON hr_records FOR ALL USING (true) WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Allow all access on location_pings" ON location_pings FOR ALL USING (true) WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN others THEN NULL;
END $$;

/* 5) Bank Contacts: store the bank NAME with each contact so cards and filters
   show the real name even when the bank registry is missing on a device
   (fixes the "BANK #96431" fallback badge). Safe to re-run. */
ALTER TABLE bank_contacts ADD COLUMN IF NOT EXISTS bank_name TEXT DEFAULT '';

/* Done. Optional housekeeping (uncomment to purge GPS history older than 90 days):
DELETE FROM location_pings WHERE pinged_at < now() - interval '90 days';
*/
