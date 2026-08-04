-- ================================================================
-- Bankole — Supabase Database Schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ================================================================

-- Users (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('sender', 'agent')),
  country CHAR(2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agents
CREATE TABLE IF NOT EXISTS public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  initials VARCHAR(3) NOT NULL,
  bio TEXT,
  location TEXT NOT NULL,
  specialties TEXT[] NOT NULL DEFAULT '{}',
  rating NUMERIC(3,1) NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  completed_projects INTEGER NOT NULL DEFAULT 0,
  years_experience INTEGER NOT NULL DEFAULT 0,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.agent_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  verified_on DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS public.agent_portfolio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  location TEXT NOT NULL,
  summary TEXT NOT NULL,
  image_url TEXT
);

CREATE TABLE IF NOT EXISTS public.agent_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  author_location TEXT NOT NULL,
  quote TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Projects
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  location_label TEXT NOT NULL,
  location_lat NUMERIC(9,6) NOT NULL,
  location_lng NUMERIC(9,6) NOT NULL,
  agent_id UUID NOT NULL REFERENCES public.agents(id),
  sender_id UUID NOT NULL REFERENCES public.users(id),
  currency CHAR(3) NOT NULL DEFAULT 'NGN',
  total_budget BIGINT NOT NULL,
  funds_released BIGINT NOT NULL DEFAULT 0,
  funds_in_escrow BIGINT NOT NULL,
  current_stage TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('on_track','awaiting_review','attention_needed','completed')),
  scope TEXT NOT NULL,
  milestone_count INTEGER NOT NULL DEFAULT 0,
  milestones_released INTEGER NOT NULL DEFAULT 0,
  started_on DATE NOT NULL DEFAULT CURRENT_DATE,
  cover_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Ledger invariant: funds must always sum to budget
  CONSTRAINT ledger_invariant CHECK (funds_released + funds_in_escrow = total_budget)
);

-- Milestones
CREATE TABLE IF NOT EXISTS public.milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  "order" INTEGER NOT NULL,
  stage TEXT NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'NGN',
  escrow_amount BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','proof_submitted','approved','released','flagged')),
  due_date DATE NOT NULL,
  released_at TIMESTAMPTZ,
  proof_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, "order")
);

-- Proofs
CREATE TABLE IF NOT EXISTS public.proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  milestone_id UUID NOT NULL REFERENCES public.milestones(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.users(id),
  type TEXT NOT NULL CHECK (type IN ('photo','video')),
  caption TEXT NOT NULL,
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  captured_at TIMESTAMPTZ,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  geo_lat NUMERIC(9,6),
  geo_lng NUMERIC(9,6),
  has_exif_gps BOOLEAN NOT NULL DEFAULT FALSE,
  distance_from_site_metres INTEGER,
  within_site_radius BOOLEAN,
  captured_before_milestone_start BOOLEAN,
  client_mismatch BOOLEAN NOT NULL DEFAULT FALSE,
  verdict TEXT NOT NULL CHECK (verdict IN ('verified_on_site','location_mismatch','no_gps_data','stale_timestamp')),
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review','approved','flagged'))
);

-- Activity log (append-only)
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  actor_id UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Documents
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('contract','receipt','verification_record','permit','other')),
  file_url TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES public.users(id),
  uploaded_on DATE NOT NULL DEFAULT CURRENT_DATE
);

-- Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency keys (24h TTL)
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  key TEXT PRIMARY KEY,
  response TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-expire idempotency keys after 24h
CREATE OR REPLACE FUNCTION cleanup_idempotency_keys() RETURNS void LANGUAGE sql AS $$
  DELETE FROM public.idempotency_keys WHERE created_at < NOW() - INTERVAL '24 hours';
$$;

-- ================================================================
-- RPC: Atomic escrow release with ledger invariant enforcement
-- ================================================================
CREATE OR REPLACE FUNCTION release_milestone_escrow(
  p_milestone_id UUID,
  p_project_id UUID
)
RETURNS TABLE(funds_released BIGINT, funds_in_escrow BIGINT)
LANGUAGE plpgsql AS $$
DECLARE
  v_escrow_amount BIGINT;
  v_new_released BIGINT;
  v_new_escrow BIGINT;
  v_total_budget BIGINT;
BEGIN
  -- Lock the project row for this transaction
  SELECT total_budget INTO v_total_budget
  FROM public.projects
  WHERE id = p_project_id
  FOR UPDATE;

  -- Get milestone escrow amount
  SELECT escrow_amount INTO v_escrow_amount
  FROM public.milestones
  WHERE id = p_milestone_id AND project_id = p_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'milestone_not_found';
  END IF;

  -- Update project ledger
  UPDATE public.projects
  SET
    funds_released = projects.funds_released + v_escrow_amount,
    funds_in_escrow = projects.funds_in_escrow - v_escrow_amount,
    milestones_released = projects.milestones_released + 1,
    updated_at = NOW()
  WHERE id = p_project_id
  RETURNING projects.funds_released, projects.funds_in_escrow
  INTO v_new_released, v_new_escrow;

  -- Assert invariant (belt-and-suspenders after constraint)
  IF v_new_released + v_new_escrow <> v_total_budget THEN
    RAISE EXCEPTION 'ledger_invariant_violated';
  END IF;

  RETURN QUERY SELECT v_new_released, v_new_escrow;
END;
$$;

-- ================================================================
-- RPC: Increment proof count on a milestone
-- ================================================================
CREATE OR REPLACE FUNCTION increment_proof_count(p_milestone_id UUID)
RETURNS void LANGUAGE sql AS $$
  UPDATE public.milestones
  SET proof_count = proof_count + 1
  WHERE id = p_milestone_id;
$$;

-- ================================================================
-- Storage Buckets (run in Supabase dashboard > Storage)
-- Or via API:
--   supabase storage create proofs --public
--   supabase storage create documents --public
-- ================================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('proofs', 'proofs', true) ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true) ON CONFLICT DO NOTHING;

-- ================================================================
-- Row Level Security (RLS) — enable and add basic policies
-- ================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Allow service role to bypass RLS (the anon key cannot bypass, so ensure your
-- backend uses the service role key for admin operations if needed)
CREATE POLICY "users_own_record" ON public.users FOR ALL USING (auth.uid() = id);
CREATE POLICY "projects_owner_access" ON public.projects FOR ALL
  USING (sender_id = auth.uid() OR agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()));
CREATE POLICY "agents_public_read" ON public.agents FOR SELECT USING (true);
CREATE POLICY "milestones_project_access" ON public.milestones FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE sender_id = auth.uid() OR agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid())));
CREATE POLICY "proofs_project_access" ON public.proofs FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE sender_id = auth.uid() OR agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid())));
CREATE POLICY "activity_project_access" ON public.activity_log FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE sender_id = auth.uid() OR agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid())));
CREATE POLICY "documents_project_access" ON public.documents FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE sender_id = auth.uid() OR agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid())));
CREATE POLICY "messages_project_access" ON public.messages FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE sender_id = auth.uid() OR agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid())));
CREATE POLICY "idempotency_keys_own" ON public.idempotency_keys FOR ALL USING (true);
