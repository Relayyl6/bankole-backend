-- Add settings columns to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS in_app_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS auto_release_escrow TEXT NOT NULL DEFAULT 'never'
    CHECK (auto_release_escrow IN ('never', '3days', '7days')),
  ADD COLUMN IF NOT EXISTS totp_secret TEXT,
  ADD COLUMN IF NOT EXISTS two_fa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS two_fa_pending BOOLEAN NOT NULL DEFAULT FALSE;
