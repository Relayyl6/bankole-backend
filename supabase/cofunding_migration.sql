-- Project invites (co-funding)
CREATE TABLE IF NOT EXISTS public.project_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES public.users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_invites_token ON public.project_invites(token);
CREATE INDEX IF NOT EXISTS idx_project_invites_email ON public.project_invites(project_id, email);

ALTER TABLE public.project_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invites_sender" ON public.project_invites FOR ALL
  USING (invited_by = auth.uid());
