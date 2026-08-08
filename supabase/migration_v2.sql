-- ================================================================
-- Bankole — Migration v2
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- Adds all new tables required by the 14 new API endpoints.
-- Safe to run multiple times (uses IF NOT EXISTS guards).
-- ================================================================


-- ================================================================
-- 1. PAYMENTS & ESCROW WALLET
-- ================================================================

-- Cards (Sender saved payment methods)
CREATE TABLE IF NOT EXISTS public.cards (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type          TEXT        NOT NULL CHECK (type IN ('visa', 'mastercard', 'verve')),
  last4         CHAR(4)     NOT NULL,
  expiry        VARCHAR(5)  NOT NULL,
  holder        TEXT        NOT NULL,
  gateway_token TEXT        NOT NULL,
  is_default    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bank accounts (Agent withdrawal destinations)
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  bank_code      VARCHAR(10) NOT NULL,
  bank_name      TEXT        NOT NULL,
  account_number VARCHAR(20) NOT NULL,
  account_name   TEXT        NOT NULL,
  is_default     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Withdrawal requests
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount          BIGINT      NOT NULL,
  currency        CHAR(3)     NOT NULL DEFAULT 'NGN',
  bank_account_id UUID        NOT NULL REFERENCES public.bank_accounts(id),
  status          TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed')),
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ledger transactions (credit / debit history)
CREATE TABLE IF NOT EXISTS public.ledger_transactions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title      TEXT        NOT NULL,
  amount     BIGINT      NOT NULL,
  currency   CHAR(3)     NOT NULL DEFAULT 'NGN',
  type       TEXT        NOT NULL CHECK (type IN ('credit', 'debit')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.cards                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_transactions  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cards_own"               ON public.cards               FOR ALL USING (user_id = auth.uid());
CREATE POLICY "bank_accounts_own"       ON public.bank_accounts       FOR ALL USING (user_id = auth.uid());
CREATE POLICY "withdrawal_requests_own" ON public.withdrawal_requests FOR ALL USING (user_id = auth.uid());
CREATE POLICY "ledger_transactions_own" ON public.ledger_transactions FOR ALL USING (user_id = auth.uid());


-- ================================================================
-- 2. DIRECT MESSAGING (pre-project, Sender <-> Agent)
-- ================================================================

-- DM thread (one per Sender-Agent pair)
CREATE TABLE IF NOT EXISTS public.message_threads (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  agent_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  last_message TEXT,
  unread_count INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(sender_id, agent_id)
);

-- DM messages (separate from project-level messages table)
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id  UUID        NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  author_id  UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body       TEXT        NOT NULL,
  read_by    UUID[]      NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "threads_participant" ON public.message_threads FOR ALL
  USING (sender_id = auth.uid() OR agent_id = auth.uid());

CREATE POLICY "direct_messages_participant" ON public.direct_messages FOR ALL
  USING (thread_id IN (
    SELECT id FROM public.message_threads
    WHERE sender_id = auth.uid() OR agent_id = auth.uid()
  ));


-- ================================================================
-- 3. CO-FUNDING (project invites)
-- ================================================================

CREATE TABLE IF NOT EXISTS public.project_invites (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  email      TEXT        NOT NULL,
  token      TEXT        NOT NULL UNIQUE,
  invited_by UUID        NOT NULL REFERENCES public.users(id),
  status     TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_invites_token ON public.project_invites(token);
CREATE INDEX IF NOT EXISTS idx_project_invites_email ON public.project_invites(project_id, email);

ALTER TABLE public.project_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invites_sender" ON public.project_invites FOR ALL
  USING (invited_by = auth.uid());


-- ================================================================
-- 4. PROFILE, SETTINGS & SECURITY (alter existing users & agents tables)
-- ================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS wallet_balance       BIGINT  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS phone_number         TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url           TEXT,
  ADD COLUMN IF NOT EXISTS currency_preference  TEXT    NOT NULL DEFAULT 'NGN',
  ADD COLUMN IF NOT EXISTS timezone             TEXT    NOT NULL DEFAULT 'Africa/Lagos',
  ADD COLUMN IF NOT EXISTS email_notifications  BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS in_app_alerts        BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS auto_release_escrow  TEXT    NOT NULL DEFAULT 'never'
    CHECK (auto_release_escrow IN ('never', '3days', '7days')),
  ADD COLUMN IF NOT EXISTS totp_secret          TEXT,
  ADD COLUMN IF NOT EXISTS two_fa_enabled       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS two_fa_pending       BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS company_name         TEXT,
  ADD COLUMN IF NOT EXISTS portfolio_url        TEXT,
  ADD COLUMN IF NOT EXISTS availability_status  TEXT    NOT NULL DEFAULT 'Available',
  ADD COLUMN IF NOT EXISTS verification_status  TEXT    NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'pending_review', 'verified', 'rejected')),
  ADD COLUMN IF NOT EXISTS id_document_url      TEXT,
  ADD COLUMN IF NOT EXISTS credentials_url      TEXT,
  ADD COLUMN IF NOT EXISTS reference_url        TEXT,
  ADD COLUMN IF NOT EXISTS statement            TEXT;


-- ================================================================
-- 5. PROJECTS & SUPERVISION ENHANCEMENTS
-- ================================================================

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS supervision_fee_percentage INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS supervision_fee_total      BIGINT  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS supervision_fee_paid       BIGINT  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_open_for_bids           BOOLEAN DEFAULT FALSE;

-- Allow unassigned agent for open bid projects
ALTER TABLE public.projects ALTER COLUMN agent_id DROP NOT NULL;

-- Update status check constraint if needed
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_status_check 
  CHECK (status IN ('on_track', 'awaiting_review', 'attention_needed', 'completed', 'dispute', 'agent_unassigned'));


-- ================================================================
-- 6. AGENT VERIFICATIONS TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS public.agent_verifications (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID        NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  id_document_url TEXT        NOT NULL,
  credentials_url TEXT,
  reference_url   TEXT,
  statement       TEXT,
  status          TEXT        NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'verified', 'rejected')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.agent_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_verifications_own" ON public.agent_verifications FOR ALL
  USING (user_id = auth.uid());


-- ================================================================
-- 7. MARKETPLACE BIDDING TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS public.project_bids (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id              UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  agent_id                UUID        NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  proposal                TEXT        NOT NULL,
  bid_amount              BIGINT      NOT NULL,
  proposed_duration_weeks INTEGER     NOT NULL DEFAULT 12,
  status                  TEXT        NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'accepted', 'rejected', 'withdrawn')),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_bids_project_id ON public.project_bids(project_id);
CREATE INDEX IF NOT EXISTS idx_project_bids_agent_id ON public.project_bids(agent_id);

ALTER TABLE public.project_bids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_bids_read" ON public.project_bids FOR SELECT
  USING (true);

CREATE POLICY "project_bids_write" ON public.project_bids FOR ALL
  USING (agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid()));



