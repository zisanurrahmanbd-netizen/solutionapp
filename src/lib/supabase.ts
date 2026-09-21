import { createClient } from '@supabase/supabase-js';

// ── Supabase Credentials ──────────────────────────────────────────────────
// When ready with a new project, replace these values from:
// https://supabase.com/dashboard → Project Settings → API
const SUPABASE_URL = 'https://qjcuzydfxbdhepcumale.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_IBUA2iCD_p1b3rmTuC7zGg_Lk-ViIaA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});