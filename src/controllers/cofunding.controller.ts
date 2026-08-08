import { Response, NextFunction } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { supabase } from '../config/supabase.config';
import { AuthRequest } from '../middlewares/auth.middleware';
import { buildError, notFound, forbidden } from '../utils/response';
import { Role } from '../types/enums';

import { sendCoFunderInviteEmail } from '../services/email.service';

export const inviteCoFunderSchema = z.object({
  email: z.string().email('A valid email is required.'),
});

export const inviteCoFunder = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id: projectId } = req.params;
    const { email } = req.body;
    const user = req.user!;

    // 1. Verify project exists and belongs to this sender
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name, total_budget, sender_id')
      .eq('id', projectId)
      .maybeSingle();

    if (projectError) throw projectError;
    if (!project) return notFound(res, 'Project');
    if (project.sender_id !== user.id) return forbidden(res);

    // 2. Check for existing active invite
    const { data: existingInvite } = await supabase
      .from('project_invites')
      .select('id')
      .eq('project_id', projectId)
      .eq('email', email.toLowerCase())
      .eq('status', 'pending')
      .maybeSingle();

    if (existingInvite) {
      return res.status(400).json(buildError('already_invited', 'An active invite has already been sent to this email.'));
    }

    // 3. Generate secure token
    const token = crypto.randomBytes(32).toString('hex');

    // 4. Insert invite
    const { data: invite, error: insertError } = await supabase
      .from('project_invites')
      .insert({
        project_id: projectId,
        email: email.toLowerCase(),
        token,
        invited_by: user.id,
        status: 'pending',
      })
      .select('id, email, status, created_at')
      .single();

    if (insertError) throw insertError;

    // 5. Send co-funder invitation email via Nodemailer
    await sendCoFunderInviteEmail(
      email.toLowerCase(),
      token,
      user.fullName || 'A project owner',
      project.name
    );

    return res.status(201).json({
      id: invite.id,
      email: invite.email,
      status: invite.status,
      createdAt: invite.created_at,
    });
  } catch (err) {
    next(err);
  }
};
