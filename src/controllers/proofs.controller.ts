import { Response, NextFunction } from 'express';
import { z } from 'zod';
import sharp from 'sharp';
import { supabase } from '../config/supabase.config';
import { AuthRequest } from '../middlewares/auth.middleware';
import { buildError, forbidden, notFound, parsePagination, paginatedResponse } from '../utils/response';
import { extractExif, verifyProof } from '../utils/exif';
import { logActivity } from '../utils/activity';
import { runVerificationPipeline } from '../services/verification.service';
import { Role, ProofStatus, ProofType, ActivityType, RiskLevel } from '../types/enums';

// ─── Schema ───────────────────────────────────────────────────────────────────

export const uploadProofSchema = z.object({
  caption: z.string().min(1, 'Caption is required.'),
  capturedLat: z.coerce.number().optional(),
  capturedLng: z.coerce.number().optional(),
  capturedAt: z.string().datetime().optional(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatProof = (p: any) => {
  const verificationPayload = p.risk_level != null ? {
    riskLevel: p.risk_level,
    verdict: p.verdict,
    confidence: p.confidence,
    summary: p.verification_summary,
    checks: p.checks,
    flags: p.flags
  } : null;

  return {
    id: p.id,
    projectId: p.project_id,
    milestoneId: p.milestone_id,
    type: p.type,
    caption: p.caption,
    fileUrl: p.file_url,
    thumbnailUrl: p.thumbnail_url,
    capturedAt: p.captured_at,
    uploadedAt: p.uploaded_at,
    geo: p.geo_lat !== null ? { lat: p.geo_lat, lng: p.geo_lng } : null,
    verification: verificationPayload,
    status: p.status,
  };
};

const uploadToStorage = async (
  buffer: Buffer,
  fileName: string,
  bucket: string,
  mimeType: string
): Promise<string> => {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(fileName, buffer, { contentType: mimeType, upsert: false });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return urlData.publicUrl;
};

// ─── Controllers ─────────────────────────────────────────────────────────────

/** POST /milestones/:id/proofs — agent only */
export const uploadProof = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id: milestoneId } = req.params;
    const user = req.user!;
    const file = (req as any).file as Express.Multer.File | undefined;

    if (!file) {
      return res.status(400).json(buildError('no_file', 'A file is required for proof submission.'));
    }

    const { caption, capturedLat, capturedLng, capturedAt } = req.body;

    // Fetch milestone + project for verification context
    const { data: milestone, error: msError } = await supabase
      .from('milestones')
      .select('*, projects!milestones_project_id_fkey(id, location_lat, location_lng, agents!projects_agent_id_fkey(user_id))')
      .eq('id', milestoneId)
      .maybeSingle();

    if (msError) throw msError;
    if (!milestone) return notFound(res, 'Milestone');

    const project = (milestone as any).projects;

    // Only the agent assigned to this project can upload proofs
    if (project.agents?.user_id !== user.id) return forbidden(res);

    const isPhoto = file.mimetype.startsWith('image/');
    const proofType: ProofType = isPhoto ? ProofType.PHOTO : ProofType.VIDEO;
    const timestamp = Date.now();
    const ext = file.originalname.split('.').pop() ?? 'bin';
    const fileName = `proofs/${milestoneId}/${timestamp}.${ext}`;
    const thumbFileName = isPhoto ? `proofs/${milestoneId}/${timestamp}_thumb.jpg` : null;

    // Upload original file to Supabase Storage
    const fileUrl = await uploadToStorage(file.buffer, fileName, 'proofs', file.mimetype);

    // Generate and upload thumbnail for images
    let thumbnailUrl: string | null = null;
    if (isPhoto && thumbFileName) {
      const thumbBuffer = await sharp(file.buffer)
        .resize(400, 300, { fit: 'cover' })
        .jpeg({ quality: 75 })
        .toBuffer();
      thumbnailUrl = await uploadToStorage(thumbBuffer, thumbFileName, 'proofs', 'image/jpeg');
    }

    // Server-side EXIF extraction — client values are advisory only
    const exif = await extractExif(file.buffer);
    const clientCapturedAt = capturedAt ? new Date(capturedAt) : null;
    const milestoneCreatedAt = new Date(milestone.created_at ?? Date.now());

    const verification = verifyProof({
      exif,
      siteLat: project.location_lat,
      siteLng: project.location_lng,
      milestoneCreatedAt,
      clientLat: capturedLat ?? null,
      clientLng: capturedLng ?? null,
      clientCapturedAt,
    });

    // Persist proof record (synchronous insertion)
    const { data: proof, error: insertError } = await supabase
      .from('proofs')
      .insert({
        project_id: project.id,
        milestone_id: milestoneId,
        uploaded_by: user.id,
        type: proofType,
        caption,
        file_url: fileUrl,
        thumbnail_url: thumbnailUrl,
        captured_at: exif.capturedAt?.toISOString() ?? capturedAt ?? null,
        uploaded_at: new Date().toISOString(),
        geo_lat: exif.lat,
        geo_lng: exif.lng,
        has_exif_gps: verification.hasExifGps,
        distance_from_site_metres: verification.distanceFromSiteMetres,
        within_site_radius: verification.withinSiteRadius,
        captured_before_milestone_start: verification.capturedBeforeMilestoneStart,
        client_mismatch: verification.clientMismatch,
        verdict: verification.verdict,
        status: ProofStatus.PENDING_REVIEW,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Fire off async Verification Pipeline
    runVerificationPipeline(
      proof.id as string,
      project.id as string,
      milestoneId as string,
      file.buffer,
      file.mimetype,
      {
        hasExifGps: verification.hasExifGps,
        distanceFromSiteMetres: verification.distanceFromSiteMetres,
        withinSiteRadius: verification.withinSiteRadius,
        capturedBeforeMilestoneStart: verification.capturedBeforeMilestoneStart,
        clientMismatch: verification.clientMismatch,
        baseVerdict: verification.verdict,
      }
    ).catch(err => console.error('Verification pipeline error:', err));

    // Increment proof_count on the milestone
    await supabase.rpc('increment_proof_count', { p_milestone_id: milestoneId });

    await logActivity({
      projectId: project.id,
      type: ActivityType.PROOF_SUBMITTED,
      message: `New progress proof submitted for "${milestone.stage}".`,
      actorId: user.id,
    });

    return res.status(201).json(formatProof(proof));
  } catch (err) {
    next(err);
  }
};

/** GET /proofs/:id/verification */
export const getProofVerification = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    // Verify ownership
    const { data: proof, error: proofError } = await supabase
      .from('proofs')
      .select('*, projects!proofs_project_id_fkey(sender_id, agents!projects_agent_id_fkey(user_id))')
      .eq('id', id)
      .maybeSingle();

    if (proofError) throw proofError;
    if (!proof) return notFound(res, 'Proof');

    const project = (proof as any).projects;
    const agentUserId = project.agents?.user_id;
    const isOwner = project.sender_id === user.id || agentUserId === user.id;
    if (!isOwner) return forbidden(res);

    return res.status(200).json(formatProof(proof));
  } catch (err) {
    next(err);
  }
};

/** GET /projects/:id/proofs */
export const listProjectProofs = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id: projectId } = req.params;
    const user = req.user!;
    const pagination = parsePagination(req.query);
    const { milestoneId, status } = req.query as Record<string, string>;

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

    let query = supabase
      .from('proofs')
      .select('*', { count: 'exact' })
      .eq('project_id', projectId)
      .order('uploaded_at', { ascending: false })
      .range(pagination.offset, pagination.offset + pagination.perPage - 1);

    if (milestoneId) query = query.eq('milestone_id', milestoneId);
    if (status) query = query.eq('status', status);

    const { data, count, error } = await query;
    if (error) throw error;

    return res.status(200).json(paginatedResponse((data ?? []).map(formatProof), count ?? 0, pagination));
  } catch (err) {
    next(err);
  }
};

/** POST /proofs/:id/approve — sender only */
export const approveProof = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const { data: proof, error } = await supabase
      .from('proofs')
      .select('*, projects!proofs_project_id_fkey(sender_id)')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!proof) return notFound(res, 'Proof');

    const project = (proof as any).projects;
    if (project.sender_id !== user.id) return forbidden(res);

    const { data: updated, error: updateError } = await supabase
      .from('proofs')
      .update({ status: ProofStatus.APPROVED })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    return res.status(200).json(formatProof(updated));
  } catch (err) {
    next(err);
  }
};

/** POST /proofs/:id/flag — sender only */
export const flagProof = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const { data: proof, error } = await supabase
      .from('proofs')
      .select('*, projects!proofs_project_id_fkey(sender_id)')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!proof) return notFound(res, 'Proof');

    const project = (proof as any).projects;
    if (project.sender_id !== user.id) return forbidden(res);

    const { data: updated, error: updateError } = await supabase
      .from('proofs')
      .update({ status: ProofStatus.FLAGGED })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    return res.status(200).json(formatProof(updated));
  } catch (err) {
    next(err);
  }
};
