import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase.config';
import { AuthRequest } from '../middlewares/auth.middleware';
import { buildError, conflict, forbidden, notFound } from '../utils/response';
import { logActivity } from '../utils/activity';
import { releaseMilestoneEscrow } from '../utils/ledger';
import { formatMilestone, getUserAgentId } from './projects.controller';
import { Role, MilestoneStatus, ActivityType } from '../types/enums';

// ─── Schemas ─────────────────────────────────────────────────────────────────

export const flagMilestoneSchema = z.object({
  reason: z.string().min(10, 'Flag reason must be at least 10 characters.'),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getMilestoneWithProject = async (milestoneId: string) => {
  const { data, error } = await supabase
    .from('milestones')
    .select('*, projects!milestones_project_id_fkey(id, sender_id, location_lat, location_lng, name, agents!projects_agent_id_fkey(user_id))')
    .eq('id', milestoneId)
    .maybeSingle();
  return { data, error };
};

const assertSenderOwnership = (project: any, userId: string, res: Response): boolean => {
  if (project.sender_id !== userId) {
    forbidden(res);
    return false;
  }
  return true;
};

const assertAgentOwnership = async (project: any, userId: string, res: Response): Promise<boolean> => {
  const agentUserId = project.agents?.user_id;
  if (agentUserId !== userId) {
    forbidden(res);
    return false;
  }
  return true;
};

// ─── Controllers ─────────────────────────────────────────────────────────────

/** GET /projects/:id/milestones */
export const listMilestones = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id: projectId } = req.params;
    const user = req.user!;

    // Verify project ownership
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

    const { data: milestones, error } = await supabase
      .from('milestones')
      .select('*')
      .eq('project_id', projectId)
      .order('order', { ascending: true });

    if (error) throw error;

    const today = new Date();
    return res.status(200).json((milestones ?? []).map((m: any) => formatMilestone(m, today)));
  } catch (err) {
    next(err);
  }
};

/** POST /milestones/:id/fund — sender only */
export const fundMilestone = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const { data: milestone, error } = await getMilestoneWithProject(id as string);
    if (error) throw error;
    if (!milestone) return notFound(res, 'Milestone');

    const project = (milestone as any).projects;
    if (!assertSenderOwnership(project, user.id, res)) return;

    if (milestone.is_funded) {
      return res.status(400).json(buildError('already_funded', 'This milestone is already funded.'));
    }

    // Check wallet balance
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('wallet_balance')
      .eq('id', user.id)
      .single();
    
    if (profileError) throw profileError;

    const balance = Number(userProfile?.wallet_balance || 0);
    if (balance < milestone.escrow_amount) {
      return res.status(400).json(buildError('insufficient_funds', `You need at least ₦${milestone.escrow_amount.toLocaleString()} in your wallet to fund this milestone.`));
    }

    // Deduct from wallet
    const { error: updateError } = await supabase
      .from('users')
      .update({ wallet_balance: balance - milestone.escrow_amount })
      .eq('id', user.id);
    
    if (updateError) throw updateError;

    // Add to project escrow
    const { error: projError } = await supabase
      .from('projects')
      .update({ funds_in_escrow: project.funds_in_escrow + milestone.escrow_amount })
      .eq('id', project.id);
    
    if (projError) throw projError;

    // Mark milestone as funded
    const { data: updated, error: msError } = await supabase
      .from('milestones')
      .update({ is_funded: true })
      .eq('id', id)
      .select()
      .single();
    
    if (msError) throw msError;

    await supabase.from('ledger_transactions').insert({
      user_id: user.id,
      title: `Funded Milestone: ${milestone.stage}`,
      amount: milestone.escrow_amount,
      currency: 'NGN',
      type: 'debit',
    });

    await logActivity({
      projectId: project.id,
      type: ActivityType.MILESTONE_APPROVED, // Re-using activity type or create a new one
      message: `Milestone "${milestone.stage}" was funded and is now protected in escrow.`,
      actorId: user.id,
    });

    return res.status(200).json(formatMilestone(updated, new Date()));
  } catch (err) {
    next(err);
  }
};

/** POST /milestones/:id/submit — agent only */
export const submitMilestone = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const { data: milestone, error } = await getMilestoneWithProject(id as string);
    if (error) throw error;
    if (!milestone) return notFound(res, 'Milestone');

    const project = (milestone as any).projects;
    if (!(await assertAgentOwnership(project, user.id, res))) return;

    if (milestone.status !== MilestoneStatus.IN_PROGRESS) {
      return conflict(res, 'invalid_milestone_status', `Cannot submit a milestone with status "${milestone.status}".`);
    }

    if (!milestone.is_funded) {
      return res.status(409).json(buildError('unfunded_milestone', 'You cannot submit work for an unfunded milestone. Please wait for the Funder to deposit escrow.'));
    }

    // Require at least one proof attached
    const { count: proofCount } = await supabase
      .from('proofs')
      .select('id', { count: 'exact', head: true })
      .eq('milestone_id', id);

    if (!proofCount || proofCount === 0) {
      return res.status(409).json(buildError('no_proof_attached', 'You must attach at least one proof before submitting a milestone for review.'));
    }

    const { data: updated, error: updateError } = await supabase
      .from('milestones')
      .update({ status: MilestoneStatus.PROOF_SUBMITTED })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    await logActivity({
      projectId: project.id,
      type: ActivityType.PROOF_SUBMITTED,
      message: `Milestone "${milestone.stage}" was submitted for review.`,
      actorId: user.id,
    });

    return res.status(200).json(formatMilestone(updated, new Date()));
  } catch (err) {
    next(err);
  }
};

/** POST /milestones/:id/approve — sender only */
export const approveMilestone = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const user = req.user!;

    const { data: milestone, error } = await getMilestoneWithProject(id as string);
    if (error) throw error;
    if (!milestone) return notFound(res, 'Milestone');

    const project = (milestone as any).projects;
    if (!assertSenderOwnership(project, user.id, res)) return;

    if (milestone.status !== MilestoneStatus.PROOF_SUBMITTED) {
      return conflict(res, 'invalid_milestone_status', `Cannot approve a milestone with status "${milestone.status}". Proof must be submitted first.`);
    }

    const { data: updated, error: updateError } = await supabase
      .from('milestones')
      .update({ status: MilestoneStatus.APPROVED })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    const logMessage = note 
      ? `Milestone "${milestone.stage}" has been approved. Note: ${note}`
      : `Milestone "${milestone.stage}" has been approved.`;

    await logActivity({
      projectId: project.id,
      type: ActivityType.MILESTONE_APPROVED,
      message: logMessage,
      actorId: user.id,
    });

    return res.status(200).json(formatMilestone(updated, new Date()));
  } catch (err) {
    next(err);
  }
};

/** POST /milestones/:id/flag — sender only */
export const flagMilestone = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = req.user!;
    const { reason } = req.body;

    const { data: milestone, error } = await getMilestoneWithProject(id as string);
    if (error) throw error;
    if (!milestone) return notFound(res, 'Milestone');

    const project = (milestone as any).projects;
    if (!assertSenderOwnership(project, user.id, res)) return;

    const allowedStatuses: string[] = [MilestoneStatus.PROOF_SUBMITTED, MilestoneStatus.IN_PROGRESS];
    if (!allowedStatuses.includes(milestone.status)) {
      return conflict(res, 'invalid_milestone_status', `Cannot flag a milestone with status "${milestone.status}".`);
    }

    const { data: updated, error: updateError } = await supabase
      .from('milestones')
      .update({ status: MilestoneStatus.FLAGGED })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    await logActivity({
      projectId: project.id,
      type: ActivityType.MILESTONE_FLAGGED,
      message: `Milestone "${milestone.stage}" was flagged: ${reason}`,
      actorId: user.id,
    });

    return res.status(200).json(formatMilestone(updated, new Date()));
  } catch (err) {
    next(err);
  }
};

/** POST /milestones/:id/release — idempotent, sender only */
export const releaseMilestone = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const { data: milestone, error } = await getMilestoneWithProject(id as string);
    if (error) throw error;
    if (!milestone) return notFound(res, 'Milestone');

    const project = (milestone as any).projects;
    if (!assertSenderOwnership(project, user.id, res)) return;

    if (milestone.status !== MilestoneStatus.APPROVED) {
      return res.status(409).json(
        buildError('milestone_not_ready', 'This milestone cannot be released until its proof is approved.')
      );
    }

    // Atomic ledger release via Supabase RPC
    const { fundsReleased, fundsInEscrow } = await releaseMilestoneEscrow(id as string, project.id as string);

    // Update milestone status and milestones_released count
    await supabase.from('milestones').update({
      status: MilestoneStatus.RELEASED,
      released_at: new Date().toISOString(),
    }).eq('id', id);

    // milestones_released is handled inside the release_milestone_escrow RPC

    const { data: updatedMilestone } = await supabase
      .from('milestones')
      .select('*')
      .eq('id', id)
      .single();

    await logActivity({
      projectId: project.id,
      type: ActivityType.MILESTONE_RELEASED,
      message: `Funds released for milestone "${milestone.stage}".`,
      actorId: user.id,
    });

    return res.status(200).json({
      milestone: formatMilestone(updatedMilestone, new Date()),
      fundsReleased,
      fundsInEscrow,
    });
  } catch (err) {
    next(err);
  }
};
