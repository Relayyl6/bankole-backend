import { Response, NextFunction } from 'express';
import { supabase } from '../config/supabase.config';
import { AuthRequest } from '../middlewares/auth.middleware';
import { Role } from '../types/enums';
import { getUserAgentId } from './projects.controller';

/** GET /dashboard/summary */
export const getDashboardSummary = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;

    // Determine ownership column
    let projectFilter: { column: string; value: string };
    if (user.role === Role.AGENT) {
      const agentId = await getUserAgentId(user.id);
      projectFilter = { column: 'agent_id', value: agentId ?? '' };
    } else {
      projectFilter = { column: 'sender_id', value: user.id };
    }

    // Fetch all projects for this user
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, total_budget, funds_released, funds_in_escrow, status, currency')
      .eq(projectFilter.column, projectFilter.value);

    if (projectsError) throw projectsError;

    const projectIds = (projects ?? []).map((p: any) => p.id);

    // Aggregate financials
    const totals = (projects ?? []).reduce(
      (acc: any, p: any) => ({
        totalBudget: acc.totalBudget + p.total_budget,
        totalReleased: acc.totalReleased + p.funds_released,
        totalInEscrow: acc.totalInEscrow + p.funds_in_escrow,
      }),
      { totalBudget: 0, totalReleased: 0, totalInEscrow: 0 }
    );

    const awaitingReview = (projects ?? []).filter(
      (p: any) => p.status === 'awaiting_review'
    ).length;

    const attentionNeeded = (projects ?? []).filter(
      (p: any) => p.status === 'attention_needed'
    ).length;

    // 5 most recent activity items across all user's projects
    let recentActivity: any[] = [];
    if (projectIds.length > 0) {
      const { data: activity } = await supabase
        .from('activity_log')
        .select('*, users!activity_log_actor_id_fkey(id, full_name, role)')
        .in('project_id', projectIds)
        .order('created_at', { ascending: false })
        .limit(5);

      recentActivity = (activity ?? []).map((a: any) => ({
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
      }));
    }

    // Currency is uniform — pick from first project or default
    const currency = projects?.[0]?.currency ?? 'NGN';

    return res.status(200).json({
      currency,
      projectCount: (projects ?? []).length,
      totalBudget: totals.totalBudget,
      totalReleased: totals.totalReleased,
      totalInEscrow: totals.totalInEscrow,
      awaitingYourReview: awaitingReview,
      attentionNeeded,
      recentActivity,
    });
  } catch (err) {
    next(err);
  }
};
