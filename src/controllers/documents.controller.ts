import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase.config';
import { AuthRequest } from '../middlewares/auth.middleware';
import { forbidden, notFound, parsePagination, paginatedResponse, buildError } from '../utils/response';
import { logActivity } from '../utils/activity';
import { DocumentKind, ActivityType, Role } from '../types/enums';

// ─── Schema ───────────────────────────────────────────────────────────────────

export const uploadDocumentSchema = z.object({
  name: z.string().min(1, 'Document name is required.'),
  kind: z.enum(Object.values(DocumentKind) as [string, ...string[]]),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDocument = (d: any) => ({
  id: d.id,
  projectId: d.project_id,
  name: d.name,
  kind: d.kind,
  fileUrl: d.file_url,
  sizeBytes: d.size_bytes,
  uploadedBy: { id: d.users?.id ?? d.uploaded_by, name: d.users?.full_name ?? 'Unknown' },
  uploadedOn: d.uploaded_on,
});

const assertProjectAccess = async (projectId: string, userId: string, res: Response, role?: Role) => {
  const { data: project, error } = await supabase
    .from('projects')
    .select('id, sender_id, is_open_for_bids, agents!projects_agent_id_fkey(user_id)')
    .eq('id', projectId)
    .maybeSingle();

  if (error || !project) { notFound(res, 'Project'); return null; }

  const agentUserId = (project as any).agents?.user_id;
  const isOwner = project.sender_id === userId || agentUserId === userId;
  const isMarketplaceAccess = role === Role.AGENT && project.is_open_for_bids;
  if (!isOwner && !isMarketplaceAccess) { forbidden(res); return null; }
  return project;
};

// ─── Controllers ─────────────────────────────────────────────────────────────

/** GET /projects/:id/documents */
export const listDocuments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id: projectId } = req.params;
    const pagination = parsePagination(req.query);

    const project = await assertProjectAccess(projectId as string, req.user!.id, res, req.user!.role);
    if (!project) return;

    const { data, count, error } = await supabase
      .from('documents')
      .select('*, users!documents_uploaded_by_fkey(id, full_name)', { count: 'exact' })
      .eq('project_id', projectId)
      .order('uploaded_on', { ascending: false })
      .range(pagination.offset, pagination.offset + pagination.perPage - 1);

    if (error) throw error;

    return res.status(200).json(paginatedResponse((data ?? []).map(formatDocument), count ?? 0, pagination));
  } catch (err) {
    next(err);
  }
};

/** POST /projects/:id/documents */
export const uploadDocument = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id: projectId } = req.params;
    const user = req.user!;
    const file = (req as any).file as Express.Multer.File | undefined;

    if (!file) return res.status(400).json(buildError('no_file', 'A file is required.'));

    const project = await assertProjectAccess(projectId as string, user.id, res, user.role);
    if (!project) return;

    const { name, kind } = req.body;

    const timestamp = Date.now();
    const ext = file.originalname.split('.').pop() ?? 'bin';
    const storagePath = `documents/${projectId}/${timestamp}.${ext}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, file.buffer, { contentType: file.mimetype });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(uploadData.path);

    const { data: doc, error: insertError } = await supabase
      .from('documents')
      .insert({
        project_id: projectId,
        name,
        kind,
        file_url: urlData.publicUrl,
        size_bytes: file.size,
        uploaded_by: user.id,
        uploaded_on: new Date().toISOString().split('T')[0],
      })
      .select('*, users!documents_uploaded_by_fkey(id, full_name)')
      .single();

    if (insertError) throw insertError;

    await logActivity({
      projectId: projectId as string,
      type: ActivityType.DOCUMENT_UPLOADED,
      message: `Document "${name}" was uploaded.`,
      actorId: user.id,
    });

    return res.status(201).json(formatDocument(doc));
  } catch (err) {
    next(err);
  }
};

/** DELETE /documents/:id */
export const deleteDocument = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const { data: doc, error } = await supabase
      .from('documents')
      .select('id, project_id, uploaded_by, file_url')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!doc) return notFound(res, 'Document');
    if (doc.uploaded_by !== user.id) return forbidden(res);

    // Delete from storage
    const storagePath = doc.file_url.split('/documents/')[1];
    if (storagePath) {
      await supabase.storage.from('documents').remove([storagePath]);
    }

    await supabase.from('documents').delete().eq('id', id);

    return res.status(204).send();
  } catch (err) {
    next(err);
  }
};
