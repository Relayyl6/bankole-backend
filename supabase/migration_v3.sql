-- ================================================================
-- BANKOLE BACKEND MIGRATION V3
-- Adds AI Verification columns to the proofs table
-- ================================================================

ALTER TABLE public.proofs
  ADD COLUMN IF NOT EXISTS risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'unverifiable')),
  ADD COLUMN IF NOT EXISTS confidence NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS verification_summary TEXT,
  ADD COLUMN IF NOT EXISTS checks JSONB,
  ADD COLUMN IF NOT EXISTS flags JSONB,
  ADD COLUMN IF NOT EXISTS perceptual_hash TEXT;
