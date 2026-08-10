-- 1. Add funding_mode to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS funding_mode TEXT DEFAULT 'upfront';

-- 2. Add is_funded to milestones
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS is_funded BOOLEAN DEFAULT true;
