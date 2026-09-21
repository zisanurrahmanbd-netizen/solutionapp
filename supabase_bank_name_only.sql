/*
Minimal fix for the "BANK #96431" badge on Bank Contacts cards.
Adds the bank_name column so every contact stores its bank's name.

HOW TO RUN: Supabase Dashboard -> SQL Editor -> New query
Paste everything below (or just the ALTER line), click Run.
Safe to run multiple times.
*/

ALTER TABLE bank_contacts ADD COLUMN IF NOT EXISTS bank_name TEXT DEFAULT '';
