-- Cards table
CREATE TABLE IF NOT EXISTS public.cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('visa', 'mastercard', 'verve')),
  last4 CHAR(4) NOT NULL,
  expiry VARCHAR(5) NOT NULL,
  holder TEXT NOT NULL,
  gateway_token TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bank accounts table
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  bank_code VARCHAR(10) NOT NULL,
  bank_name TEXT NOT NULL,
  account_number VARCHAR(20) NOT NULL,
  account_name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Withdrawal requests table
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'NGN',
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ledger transactions table
CREATE TABLE IF NOT EXISTS public.ledger_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount BIGINT NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'NGN',
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cards_own" ON public.cards FOR ALL USING (user_id = auth.uid());
CREATE POLICY "bank_accounts_own" ON public.bank_accounts FOR ALL USING (user_id = auth.uid());
CREATE POLICY "withdrawal_requests_own" ON public.withdrawal_requests FOR ALL USING (user_id = auth.uid());
CREATE POLICY "ledger_transactions_own" ON public.ledger_transactions FOR ALL USING (user_id = auth.uid());
