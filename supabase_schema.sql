-- ═══════════════════════════════════════════════════════════════════════
-- RecoveryCORE — Supabase Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Users table (agents, managers, admins)
CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'User',
  email TEXT UNIQUE NOT NULL,
  phone TEXT DEFAULT '',
  employee_id TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'manager', 'agent')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  password TEXT DEFAULT '',
  manager_id BIGINT,
  manager_name TEXT,
  last_latitude DOUBLE PRECISION,
  last_longitude DOUBLE PRECISION,
  last_ping_at TIMESTAMPTZ,
  is_online BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Cases table (recovery files)
CREATE TABLE IF NOT EXISTS cases (
  id BIGINT PRIMARY KEY,
  file_number TEXT NOT NULL DEFAULT '',
  bank_id BIGINT NOT NULL DEFAULT 1,
  product_id BIGINT NOT NULL DEFAULT 1,
  account_number TEXT DEFAULT '',
  customer_name TEXT NOT NULL DEFAULT 'Customer',
  customer_phone TEXT DEFAULT '',
  customer_secondary_phone TEXT DEFAULT '',
  customer_address_present TEXT DEFAULT '',
  customer_address_permanent TEXT DEFAULT '',
  present_address_visited BOOLEAN DEFAULT false,
  permanent_address_visited BOOLEAN DEFAULT false,
  outstanding_amount DOUBLE PRECISION DEFAULT 0,
  overdue_amount DOUBLE PRECISION DEFAULT 0,
  minimum_payment DOUBLE PRECISION,
  status TEXT DEFAULT 'new',
  legal_status TEXT DEFAULT 'Normal Recovery',
  availability_status TEXT,
  assigned_agent_id BIGINT,
  agent_name TEXT DEFAULT '',
  collector_name TEXT DEFAULT '',
  assigned_manager_id BIGINT,
  allocation_date TEXT,
  expiry_date TEXT,
  last_visit_at TIMESTAMPTZ,
  total_collected_amount DOUBLE PRECISION DEFAULT 0,
  extra_attributes JSONB DEFAULT '{}',
  bank_name TEXT,
  product_name TEXT,
  branch_name TEXT,
  area TEXT,
  lap_status TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Case remarks (contact logs, PTP promises)
CREATE TABLE IF NOT EXISTS case_remarks (
  id BIGINT PRIMARY KEY,
  case_file_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  contact_status TEXT DEFAULT 'contacted',
  promised_amount DOUBLE PRECISION,
  promise_date TEXT,
  remarks TEXT DEFAULT '',
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. GPS check-ins (field visits)
CREATE TABLE IF NOT EXISTS check_ins (
  id BIGINT PRIMARY KEY,
  case_file_id BIGINT NOT NULL,
  agent_id BIGINT NOT NULL,
  address_type TEXT DEFAULT 'present',
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  notes TEXT DEFAULT '',
  photo_url TEXT,
  visited_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Collections (payment receipts)
CREATE TABLE IF NOT EXISTS collections (
  id BIGINT PRIMARY KEY,
  case_file_id BIGINT NOT NULL,
  agent_id BIGINT NOT NULL,
  amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'cash',
  receipt_number TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  photo_url TEXT,
  collected_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  verified_at TIMESTAMPTZ,
  verified_by TEXT
);

-- 6. Bank contacts directory
CREATE TABLE IF NOT EXISTS bank_contacts (
  id BIGINT PRIMARY KEY,
  bank_id BIGINT NOT NULL DEFAULT 1,
  name TEXT NOT NULL DEFAULT '',
  designation TEXT DEFAULT '',
  department TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  branch TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. File templates & system settings (Google Sheet sync, sessions, etc.)
CREATE TABLE IF NOT EXISTS file_templates (
  template_key TEXT PRIMARY KEY,
  definition JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════
-- Enable Realtime for live cross-device sync
-- ═══════════════════════════════════════════════════════════════════════
ALTER PUBLICATION supabase_realtime ADD TABLE users;
ALTER PUBLICATION supabase_realtime ADD TABLE cases;
ALTER PUBLICATION supabase_realtime ADD TABLE case_remarks;
ALTER PUBLICATION supabase_realtime ADD TABLE check_ins;
ALTER PUBLICATION supabase_realtime ADD TABLE collections;
ALTER PUBLICATION supabase_realtime ADD TABLE bank_contacts;
ALTER PUBLICATION supabase_realtime ADD TABLE file_templates;

-- ═══════════════════════════════════════════════════════════════════════
-- Indexes for fast queries
-- ═══════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_cases_bank_id ON cases(bank_id);
CREATE INDEX IF NOT EXISTS idx_cases_agent_id ON cases(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_cases_manager_id ON cases(assigned_manager_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_file_number ON cases(file_number);
CREATE INDEX IF NOT EXISTS idx_remarks_case_id ON case_remarks(case_file_id);
CREATE INDEX IF NOT EXISTS idx_checkins_case_id ON check_ins(case_file_id);
CREATE INDEX IF NOT EXISTS idx_collections_case_id ON collections(case_file_id);
CREATE INDEX IF NOT EXISTS idx_contacts_bank_id ON bank_contacts(bank_id);

-- ═══════════════════════════════════════════════════════════════════════
-- RLS policies (Row Level Security) — permissive for now
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_remarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_templates ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated and anon access (tighten later for production)
CREATE POLICY "Allow all access on users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on cases" ON cases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on case_remarks" ON case_remarks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on check_ins" ON check_ins FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on collections" ON collections FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on bank_contacts" ON bank_contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on file_templates" ON file_templates FOR ALL USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════
-- Default admin user (Zisan Ur Rahman)
-- ═══════════════════════════════════════════════════════════════════════
INSERT INTO users (id, name, email, phone, employee_id, role, status, password, is_online)
VALUES (1, 'Zisan Ur Rahman', 'zisanurrahmanbd@gmail.com', '01608800026', 'ADMIN-001', 'admin', 'active', '@01608800026', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  role = 'admin',
  status = 'active',
  password = EXCLUDED.password;
