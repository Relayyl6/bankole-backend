import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase.config';
import { AuthRequest } from '../middlewares/auth.middleware';
import { forbidden, notFound, parsePagination, paginatedResponse } from '../utils/response';
import { logActivity } from '../utils/activity';
import { ActivityType } from '../types/enums';

// ─── Schema ───────────────────────────────────────────────────────────────────

export const createMessageSchema = z.object({
  body: z.string().min(1, 'Message body cannot be empty.').max(4000),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatMessage = (m: any) => ({
  id: m.id,
  projectId: m.project_id,
  author: {
    id: m.users?.id ?? m.author_id,
    name: m.users?.full_name ?? 'Unknown',
    role: m.users?.role ?? 'unknown',
  },
  body: m.body,
  createdAt: m.created_at,
});

// ─── Controllers ─────────────────────────────────────────────────────────────

/** GET /projects/:id/messages — paginated, oldest first */
export const listMessages = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id: projectId } = req.params;
    const user = req.user!;
    const pagination = parsePagination(req.query);

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
      .from('messages')
      .select('*, users!messages_author_id_fkey(id, full_name, role)', { count: 'exact' })
      .eq('project_id', projectId)
      .order('created_at', { ascending: true }) // oldest first per spec
      .range(pagination.offset, pagination.offset + pagination.perPage - 1);

    if (error) throw error;

    return res.status(200).json(paginatedResponse((data ?? []).map(formatMessage), count ?? 0, pagination));
  } catch (err) {
    next(err);
  }
};

/** POST /projects/:id/messages */
export const createMessage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id: projectId } = req.params;
    const user = req.user!;
    const { body } = req.body;

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

    const { data: message, error: insertError } = await supabase
      .from('messages')
      .insert({
        project_id: projectId,
        author_id: user.id,
        body,
        created_at: new Date().toISOString(),
      })
      .select('*, users!messages_author_id_fkey(id, full_name, role)')
      .single();

    if (insertError) throw insertError;

    await logActivity({
      projectId: projectId as string,
      type: ActivityType.MESSAGE_SENT,
      message: `New message from ${user.fullName}.`,
      actorId: user.id,
    });

    return res.status(201).json(formatMessage(message));
  } catch (err) {
    next(err);
  }
};
