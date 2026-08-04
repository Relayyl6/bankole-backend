import { Response, NextFunction } from 'express';
import { supabase } from '../config/supabase.config';
import { AuthRequest } from '../middlewares/auth.middleware';
import { forbidden, notFound, parsePagination, paginatedResponse } from '../utils/response';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatActivity = (a: any) => ({
  id: a.id,
  projectId: a.project_id,
  type: a.type,
  message: a.message,
  actor: {
    id: a.users?.id ?? a.actor_id,
    name: a.users?.full_name ?? 'Unknown',
    role: a.users?.role ?? 'unknown',
  },
  createdAt: a.created_at,
});

// ─── Controller ───────────────────────────────────────────────────────────────

/** GET /projects/:id/activity */
export const listProjectActivity = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id: projectId } = req.params;
    const user = req.user!;
    const pagination = parsePagination(req.query);

    // Verify ownership
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, sender_id, agents!projects_agent_id_fkey(user_id)')
      .eq('id', projectId)
      .maybeSingle();

    if (projectError) throw projectError;
    if (!project) return notFound(res, 'Project');

    const agentUserId = (project as any).agents?.user_id;
    const isOwner = project.sender_id === user.id || agentUserId === user.id;
    if (!isOwner) return forbidden(res);

    const { data, count, error } = await supabase
      .from('activity_log')
      .select('*, users!activity_log_actor_id_fkey(id, full_name, role)', { count: 'exact' })
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .range(pagination.offset, pagination.offset + pagination.perPage - 1);

    if (error) throw error;

    return res.status(200).json(paginatedResponse((data ?? []).map(formatActivity), count ?? 0, pagination));
  } catch (err) {
    next(err);
  }
};
