import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase.config';
import { AuthRequest } from '../middlewares/auth.middleware';
import { parsePagination, paginatedResponse, notFound, forbidden, buildError } from '../utils/response';
import { logActivity } from '../utils/activity';
import { Role, AssetType, Currency, ActivityType, ProjectStatus } from '../types/enums';

// ─── Schemas ─────────────────────────────────────────────────────────────────

const coordinatesSchema = z.object({
  label: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
});

const milestoneInputSchema = z.object({
  order: z.number().int().positive(),
  stage: z.string().min(1),
  escrowAmount: z.number().int().positive('Escrow amount must be a positive integer (minor units).'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be a date string (YYYY-MM-DD).'),
});

export const createProjectSchema = z.object({
  name: z.string().min(2),
  assetType: z.enum(Object.values(AssetType) as [string, ...string[]]),
  location: coordinatesSchema,
  agentId: z.string().min(1).optional().nullable(),
  currency: z.enum(Object.values(Currency) as [string, ...string[]]),
  totalBudget: z.number().int().positive(),
  fundingMode: z.enum(['upfront', 'milestone']).default('upfront'),
  supervisionFeePercentage: z.number().min(0).max(100).optional().default(0),
  scope: z.string().min(10, "Please type in a detailed scope of project for our agents to review"),
  milestones: z.array(milestoneInputSchema).min(1, 'At least one milestone is required.'),
});

export const patchProjectSchema = z.object({
  name: z.string().min(2).optional(),
  scope: z.string().min(10).optional(),
  currentStage: z.string().optional(),
});

export const unassignAgentSchema = z.object({
  reason: z.string().min(1, "Reason is required."),
  requestDispute: z.boolean().optional().default(false),
});

export const assignAgentSchema = z.object({
  newAgentId: z.string().min(1, "newAgentId is required."),
});

export const sendFundsSchema = z.object({
  amount: z.number().int().positive('Amount must be positive'),
  currency: z.string().default('NGN'),
  note: z.string().optional(),
});

export const submitBidSchema = z.object({
  proposal: z.string().min(5, 'Proposal description is required'),
  bidAmount: z.number().int().positive('Bid amount must be positive'),
  proposedDurationWeeks: z.union([z.number(), z.string()]).optional(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatProjectSummary = (p: any, agent: any) => ({
  id: p.id,
  name: p.name,
  assetType: p.asset_type,
  location: { label: p.location_label, lat: p.location_lat, lng: p.location_lng },
  agent: p.agent_id ? {
    id: agent?.id ?? p.agent_id,
    name: agent?.name ?? 'Unknown',
    initials: agent?.initials ?? '??',
    verified: agent?.verified ?? false,
  } : null,
  currency: p.currency,
  isOpenForBids: p.is_open_for_bids,
  totalBudget: p.total_budget,
  fundsReleased: p.funds_released,
  fundsInEscrow: p.funds_in_escrow,
  supervisionFeePercentage: p.supervision_fee_percentage,
  supervisionFeeTotal: p.supervision_fee_total,
  supervisionFeePaid: p.supervision_fee_paid,
  currentStage: p.current_stage,
  status: p.status,
  milestoneCount: p.milestone_count,
  milestonesReleased: p.milestones_released,
  startedOn: p.started_on,
  coverImageUrl: p.cover_image_url,
});

// ─── Validation helpers ───────────────────────────────────────────────────────

const validateMilestones = (milestones: z.infer<typeof milestoneInputSchema>[], totalBudget: number) => {
  // Check contiguous ordering starting at 1
  const orders = milestones.map((m) => m.order).sort((a, b) => a - b);
  for (let i = 0; i < orders.length; i++) {
    if (orders[i] !== i + 1) {
      return { valid: false, field: 'milestones[].order', message: 'Milestone order values must be contiguous starting at 1.' };
    }
  }

  // Check escrow sum
  const totalEscrow = milestones.reduce((sum, m) => sum + m.escrowAmount, 0);
  if (totalEscrow !== totalBudget) {
    return { valid: false, field: 'milestones[].escrowAmount', message: `Milestone escrow amounts must sum exactly to totalBudget. Got ${totalEscrow}, expected ${totalBudget}.` };
  }

  // Check ascending due dates
  const sorted = [...milestones].sort((a, b) => a.order - b.order);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].dueDate <= sorted[i - 1].dueDate) {
      return { valid: false, field: 'milestones[].dueDate', message: 'Milestone due dates must ascend with order.' };
    }
  }

  return { valid: true };
};

// ─── Controllers ─────────────────────────────────────────────────────────────

/** GET /projects */
export const listProjects = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const pagination = parsePagination(req.query);
    const { status, assetType, includeMarketplace } = req.query as Record<string, string>;

    let agentId: string | null = null;
    if (user.role === Role.AGENT) {
      const { data: agentRow } = await supabase
        .from('agents')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      agentId = agentRow?.id ?? null;
    }

    let query = supabase
      .from('projects')
      .select('*, agents!projects_agent_id_fkey(id, name, initials, verified)', { count: 'exact' })
      .range(pagination.offset, pagination.offset + pagination.perPage - 1)
      .order('created_at', { ascending: false });

    if (user.role === Role.AGENT) {
      if (includeMarketplace === 'true') {
        query = query.or(`agent_id.eq.${agentId ?? '00000000-0000-0000-0000-000000000000'},is_open_for_bids.eq.true`);
      } else {
        query = query.eq('agent_id', agentId ?? '00000000-0000-0000-0000-000000000000');
      }
    } else {
      query = query.eq('sender_id', user.id);
    }

    if (status) query = query.eq('status', status);
    if (assetType) query = query.eq('asset_type', assetType);

    const { data, count, error } = await query;
    if (error) throw error;

    const formatted = (data ?? []).map((p: any) => formatProjectSummary(p, p.agents));
    return res.status(200).json(paginatedResponse(formatted, count ?? 0, pagination));
  } catch (err) {
    next(err);
  }
};

/** GET /projects/:id */
export const getProject = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const { data: project, error } = await supabase
      .from('projects')
      .select('*, agents!projects_agent_id_fkey(id, name, initials, verified)')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!project) return notFound(res, 'Project');

    // Ownership check — 403 not 404
    const isOwner =
      project.sender_id === user.id ||
      project.agents?.id === (await getUserAgentId(user.id));
    if (!isOwner) return forbidden(res);

    const { data: milestones } = await supabase
      .from('milestones')
      .select('*')
      .eq('project_id', id)
      .order('order', { ascending: true });

    const today = new Date();

    return res.status(200).json({
      ...formatProjectSummary(project, project.agents),
      scope: project.scope,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
      milestones: (milestones ?? []).map((m: any) => formatMilestone(m, today)),
    });
  } catch (err) {
    next(err);
  }
};

/** POST /projects */
export const createProject = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { name, assetType, location, agentId, currency, totalBudget, fundingMode, supervisionFeePercentage, scope, milestones } = req.body;

    // Validate milestones business rules
    const validation = validateMilestones(milestones, totalBudget);
    if (!validation.valid) {
      return res.status(400).json(buildError('validation_error', validation.message!, validation.field));
    }

    let verifiedAgent = null;

    // Verify agent exists and is verified
    if (agentId) {
      const { data: agent, error: agentError } = await supabase
        .from('agents')
        .select('id, name, initials, verified')
        .eq('id', agentId)
        .maybeSingle();

      if (agentError || !agent) {
        return res.status(400).json(buildError('validation_error', 'The specified agent does not exist.', 'agentId'));
      }
      if (!agent.verified) {
        return res.status(400).json(buildError('validation_error', 'The specified agent is not verified.', 'agentId'));
      }
      verifiedAgent = agent;
    }

    // Create project
    const firstMilestone = [...milestones].sort((a, b) => a.order - b.order)[0];
    const now = new Date().toISOString();

    const feePercentage = supervisionFeePercentage ?? 10;

    let fundsInEscrow = 0;

    if (fundingMode === 'upfront') {
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('wallet_balance')
        .eq('id', user.id)
        .single();
      
      if (profileError) throw profileError;

      const balance = Number(userProfile?.wallet_balance || 0);
      if (balance < totalBudget) {
        return res.status(400).json(buildError('insufficient_funds', `You need at least ₦${totalBudget.toLocaleString()} in your wallet to fund this project upfront.`));
      }

      // Deduct from wallet
      const { error: updateError } = await supabase
        .from('users')
        .update({ wallet_balance: balance - totalBudget })
        .eq('id', user.id);
      
      if (updateError) throw updateError;
      
      fundsInEscrow = totalBudget;

      // Log transaction
      await supabase.from('ledger_transactions').insert({
        user_id: user.id,
        title: `Funded Project: ${name}`,
        amount: totalBudget,
        currency,
        type: 'debit',
      });
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        name,
        asset_type: assetType,
        location_label: location.label,
        location_lat: location.lat,
        location_lng: location.lng,
        agent_id: agentId || null,
        sender_id: user.id,
        currency,
        total_budget: totalBudget,
        funding_mode: fundingMode,
        funds_released: 0,
        funds_in_escrow: fundsInEscrow,
        supervision_fee_percentage: supervisionFeePercentage,
        supervision_fee_total: Math.floor((totalBudget * supervisionFeePercentage) / 100),
        supervision_fee_paid: 0,
        current_stage: firstMilestone.stage,
        status: agentId ? ProjectStatus.ON_TRACK : ProjectStatus.AGENT_UNASSIGNED,
        is_open_for_bids: !agentId,
        scope,
        milestone_count: milestones.length,
        milestones_released: 0,
        started_on: new Date().toISOString().split('T')[0],
        cover_image_url: null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (projectError) throw projectError;

    // Insert milestones
    const isFunded = fundingMode === 'upfront';
    const milestoneRows = milestones.map((m: any) => ({
      project_id: project.id,
      order: m.order,
      stage: m.stage,
      currency,
      escrow_amount: m.escrowAmount,
      status: m.order === 1 ? 'in_progress' : 'pending',
      due_date: m.dueDate,
      released_at: null,
      proof_count: 0,
      is_funded: isFunded
    }));

    const { error: msError } = await supabase.from('milestones').insert(milestoneRows);
    if (msError) throw msError;

    // Log activity
    await logActivity({
      projectId: project.id,
      type: ActivityType.PROJECT_CREATED,
      message: agentId ? `Project "${name}" was created.` : `Project "${name}" was published to the marketplace.`,
      actorId: user.id,
    });

    // Return full project detail
    const { data: fullMilestones } = await supabase
      .from('milestones')
      .select('*')
      .eq('project_id', project.id)
      .order('order', { ascending: true });

    const today = new Date();

    return res.status(201).json({
      ...formatProjectSummary(project, verifiedAgent),
      scope: project.scope,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
      milestones: (fullMilestones ?? []).map((m: any) => formatMilestone(m, today)),
    });
  } catch (err) {
    next(err);
  }
};

/** PATCH /projects/:id */
export const patchProject = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('id, sender_id')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!project) return notFound(res, 'Project');
    if (project.sender_id !== user.id) return forbidden(res);

    const updates: Record<string, any> = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.scope !== undefined) updates.scope = req.body.scope;
    if (req.body.currentStage !== undefined) {
      updates.current_stage = req.body.currentStage;
      await logActivity({
        projectId: id as string,
        type: ActivityType.STAGE_UPDATED,
        message: `Project stage updated to "${req.body.currentStage}".`,
        actorId: user.id,
      });
    }
    updates.updated_at = new Date().toISOString();

    const { data: updated, error: updateError } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    return res.status(200).json({
      id: updated.id,
      name: updated.name,
      scope: updated.scope,
      currentStage: updated.current_stage,
      updatedAt: updated.updated_at,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Shared helpers ───────────────────────────────────────────────────────────

export const formatMilestone = (m: any, today: Date) => {
  const dueDate = new Date(m.due_date);
  const isOverdue = dueDate < today && m.status !== 'released';
  const daysOverdue = isOverdue
    ? Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return {
    id: m.id,
    projectId: m.project_id,
    order: m.order,
    stage: m.stage,
    currency: m.currency,
    escrowAmount: m.escrow_amount,
    status: m.status,
    dueDate: m.due_date,
    isOverdue,
    daysOverdue,
    proofCount: m.proof_count,
    releasedAt: m.released_at,
  };
};

export const getUserAgentId = async (userId: string): Promise<string | null> => {
  const { data } = await supabase
    .from('agents')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.id ?? null;
};

/** POST /projects/:id/unassign-agent */
export const unassignAgent = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = req.user!;
    const { reason, requestDispute } = req.body;

    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('id, sender_id, agent_id, status')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!project) return notFound(res, 'Project');
    if (project.sender_id !== user.id) return forbidden(res);
    if (!project.agent_id) return res.status(400).json(buildError('invalid_state', 'No agent is currently assigned to this project.', 'agentId'));

    // Check for pending proofs (Guard Rail 1)
    const { data: milestones, error: msError } = await supabase
      .from('milestones')
      .select('status')
      .eq('project_id', id);
    if (msError) throw msError;

    const hasPendingProof = (milestones ?? []).some((m: any) => m.status === 'proof_submitted');
    if (hasPendingProof) {
      return res.status(409).json(buildError('conflict', 'Cannot unassign agent while a milestone has a pending proof. Please approve or flag it first.', 'status'));
    }

    const hasInProgress = (milestones ?? []).some((m: any) => m.status === 'in_progress');
    
    let newStatus: string = ProjectStatus.AGENT_UNASSIGNED;
    if (hasInProgress || requestDispute) {
      newStatus = ProjectStatus.DISPUTE;
    }

    const { error: updateError } = await supabase
      .from('projects')
      .update({
        agent_id: null,
        status: newStatus,
        is_open_for_bids: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) throw updateError;

    await logActivity({
      projectId: id as string,
      type: newStatus === ProjectStatus.DISPUTE ? ActivityType.DISPUTE_RAISED : ActivityType.AGENT_UNASSIGNED,
      message: `Agent was unassigned. Reason: ${reason}`,
      actorId: user.id,
    });

    return res.status(200).json({ status: newStatus, message: 'Agent unassigned successfully.' });
  } catch (err) {
    next(err);
  }
};

/** POST /projects/:id/assign-agent */
export const assignAgent = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = req.user!;
    const { newAgentId } = req.body;

    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('id, sender_id, agent_id, status')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!project) return notFound(res, 'Project');
    if (project.sender_id !== user.id) return forbidden(res);
    
    if (project.status !== ProjectStatus.AGENT_UNASSIGNED && project.status !== ProjectStatus.DISPUTE) {
      return res.status(400).json(buildError('invalid_state', 'Project must be unassigned or in dispute to assign a new agent.', 'status'));
    }

    // Verify agent exists and is verified
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, verified')
      .eq('id', newAgentId)
      .maybeSingle();

    if (agentError || !agent) {
      return res.status(400).json(buildError('validation_error', 'The specified agent does not exist.', 'newAgentId'));
    }
    if (!agent.verified) {
      return res.status(400).json(buildError('validation_error', 'The specified agent is not verified.', 'newAgentId'));
    }

    // Determine what status to resume to
    const { data: milestones } = await supabase
      .from('milestones')
      .select('status, due_date')
      .eq('project_id', id);
    
    let resumeStatus: string = ProjectStatus.ON_TRACK;
    const today = new Date().toISOString().split('T')[0];
    const hasOverdue = (milestones ?? []).some((m: any) => 
      ['pending', 'in_progress', 'flagged'].includes(m.status) && m.due_date < today
    );
    if (hasOverdue) resumeStatus = ProjectStatus.ATTENTION_NEEDED;

    const { error: updateError } = await supabase
      .from('projects')
      .update({
        agent_id: newAgentId,
        status: resumeStatus,
        is_open_for_bids: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) throw updateError;

    await logActivity({
      projectId: id as string,
      type: ActivityType.AGENT_ASSIGNED,
      message: `A new agent was assigned to the project.`,
      actorId: user.id,
    });

    return res.status(200).json({ status: resumeStatus, message: 'New agent assigned successfully.' });
  } catch (err) {
    next(err);
  }
};

/** POST /projects/:id/send-funds — sender sends mobilization funds directly to assigned agent */
export const sendMobilizationFunds = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id: projectId } = req.params;
    const user = req.user!;
    const { amount, currency, note } = req.body;

    // 1. Verify project exists and caller is sender
    const { data: project, error: pError } = await supabase
      .from('projects')
      .select('id, name, sender_id, agent_id, agents!projects_agent_id_fkey(id, user_id, name)')
      .eq('id', projectId)
      .maybeSingle();

    if (pError) throw pError;
    if (!project) return notFound(res, 'Project');
    if (project.sender_id !== user.id) return forbidden(res);

    if (!project.agent_id || !(project as any).agents?.user_id) {
      return res.status(400).json(buildError('no_assigned_agent', 'This project does not have an assigned agent yet.'));
    }

    const agentUserId = (project as any).agents.user_id;

    // 2. Fetch sender wallet balance
    const { data: senderUser, error: uError } = await supabase
      .from('users')
      .select('wallet_balance')
      .eq('id', user.id)
      .single();

    if (uError) throw uError;

    const senderBalance = senderUser?.wallet_balance ? Number(senderUser.wallet_balance) : 0;
    if (senderBalance < amount) {
      return res.status(400).json(buildError('insufficient_balance', 'Insufficient wallet balance to send mobilization funds.'));
    }

    // 3. Deduct from sender wallet & Credit agent wallet
    const senderNewBalance = senderBalance - amount;
    await supabase.from('users').update({ wallet_balance: senderNewBalance }).eq('id', user.id);

    const { data: agentUser } = await supabase.from('users').select('wallet_balance').eq('id', agentUserId).maybeSingle();
    const agentBalance = agentUser?.wallet_balance ? Number(agentUser.wallet_balance) : 0;
    await supabase.from('users').update({ wallet_balance: agentBalance + amount }).eq('id', agentUserId);

    // 4. Record transactions in ledger
    const txId = `tx_mob_${Date.now()}`;
    await supabase.from('ledger_transactions').insert([
      {
        user_id: user.id,
        title: note ? `Mobilization Funds Transfer: ${note}` : 'Mobilization Funds Transfer to Agent',
        amount,
        currency: currency || 'NGN',
        type: 'debit',
      },
      {
        user_id: agentUserId,
        title: note ? `Mobilization Funds Received: ${note}` : 'Mobilization Funds Received from Project Owner',
        amount,
        currency: currency || 'NGN',
        type: 'credit',
      },
    ]);

    // 5. Record activity
    await logActivity({
      projectId: projectId as string,
      type: ActivityType.STAGE_UPDATED,
      message: `Mobilization funds of ₦${amount.toLocaleString()} released to agent.`,
      actorId: user.id,
    });

    return res.status(200).json({
      success: true,
      amount,
      currency: currency || 'NGN',
      senderNewBalance,
      transactionId: txId,
    });
  } catch (err) {
    next(err);
  }
};

/** POST /projects/:id/bids — agent submits bid on open project */
export const submitBid = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id: projectId } = req.params;
    const user = req.user!;
    const { proposal, bidAmount, proposedDurationWeeks } = req.body;

    // Get agent profile
    const { data: agent, error: aError } = await supabase
      .from('agents')
      .select('id, verified')
      .eq('user_id', user.id)
      .maybeSingle();

    if (aError) throw aError;
    if (!agent) {
      return res.status(400).json(buildError('not_an_agent', 'Agent profile not found for this user.'));
    }

    // Verify project exists and is open for bids
    const { data: project, error: pError } = await supabase
      .from('projects')
      .select('id, is_open_for_bids, agent_id')
      .eq('id', projectId)
      .maybeSingle();

    if (pError) throw pError;
    if (!project) return notFound(res, 'Project');

    const durationWeeks = proposedDurationWeeks ? parseInt(String(proposedDurationWeeks), 10) : 12;

    const { data: bid, error: insertError } = await supabase
      .from('project_bids')
      .insert({
        project_id: projectId,
        agent_id: agent.id,
        proposal,
        bid_amount: bidAmount,
        proposed_duration_weeks: isNaN(durationWeeks) ? 12 : durationWeeks,
        status: 'submitted',
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return res.status(201).json({
      id: bid.id,
      projectId: bid.project_id,
      agentId: bid.agent_id,
      proposal: bid.proposal,
      bidAmount: bid.bid_amount,
      proposedDurationWeeks: bid.proposed_duration_weeks,
      status: bid.status,
      createdAt: bid.created_at,
    });
  } catch (err) {
    next(err);
  }
};

/** POST /projects/:id/bids/:bidId/accept — sender accepts an agent bid */
export const acceptBid = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id: projectId, bidId } = req.params;
    const user = req.user!;

    // 1. Verify project exists and caller is sender
    const { data: project, error: pError } = await supabase
      .from('projects')
      .select('id, sender_id, name')
      .eq('id', projectId)
      .maybeSingle();

    if (pError) throw pError;
    if (!project) return notFound(res, 'Project');
    if (project.sender_id !== user.id) return forbidden(res);

    // 2. Fetch bid
    const { data: bid, error: bError } = await supabase
      .from('project_bids')
      .select('id, agent_id, bid_amount')
      .eq('id', bidId)
      .eq('project_id', projectId)
      .maybeSingle();

    if (bError) throw bError;
    if (!bid) return notFound(res, 'Bid');

    // 3. Mark this bid as accepted and other bids as rejected
    await supabase.from('project_bids').update({ status: 'accepted' }).eq('id', bidId);
    await supabase.from('project_bids').update({ status: 'rejected' }).eq('project_id', projectId).neq('id', bidId);

    // 4. Assign agent to project & update status
    const { error: updateError } = await supabase
      .from('projects')
      .update({
        agent_id: bid.agent_id,
        status: ProjectStatus.ON_TRACK,
        is_open_for_bids: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    if (updateError) throw updateError;

    // 5. Log activity
    await logActivity({
      projectId: projectId as string,
      type: ActivityType.AGENT_ASSIGNED,
      message: `Agent bid accepted. Project is now active on track.`,
      actorId: user.id,
    });

    return res.status(200).json({
      success: true,
      projectId,
      agentId: bid.agent_id,
      status: ProjectStatus.ON_TRACK,
    });
  } catch (err) {
    next(err);
  }
};

/** GET /projects/:id/bids — list bids for a project */
export const listProjectBids = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id: projectId } = req.params;
    const { data: bids, error } = await supabase
      .from('project_bids')
      .select('*, agents!project_bids_agent_id_fkey(id, name, rating, review_count, verified, avatar_url)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.status(200).json({ data: bids || [] });
  } catch (err) {
    next(err);
  }
};
