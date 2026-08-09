import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase.config';
import { AuthRequest } from '../middlewares/auth.middleware';
import { parsePagination, paginatedResponse, notFound } from '../utils/response';

// ─── Query schema ─────────────────────────────────────────────────────────────

export const agentQuerySchema = z.object({
  q: z.string().optional(),
  specialty: z.union([z.string(), z.array(z.string())]).optional(),
  location: z.string().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  verifiedOnly: z.enum(['true', 'false']).optional().default('false'),
  sort: z.enum(['rating', 'experience', 'projects']).optional().default('rating'),
  page: z.coerce.number().optional(),
  perPage: z.coerce.number().optional(),
});

export const reviewAgentSchema = z.object({
  quote: z.string().min(10, 'Review must be at least 10 characters.'),
  rating: z.number().int().min(1).max(5),
});

export const addCredentialSchema = z.object({
  label: z.string().optional(),
  issuer: z.string().optional(),
  verifiedOn: z.string().optional(),
  licenseType: z.string().optional(),
  licenseNumber: z.string().optional(),
  yearIssued: z.union([z.number(), z.string()]).optional(),
});

export const addPortfolioSchema = z.object({
  title: z.string().min(2),
  location: z.string(),
  assetType: z.string().optional(),
  summary: z.string().optional(),
  imageUrl: z.string().optional(),
  coverUrl: z.string().optional(),
  completionYear: z.union([z.number(), z.string()]).optional(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Simple string hash for avatar hue */
const getAvatarHue = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `hsl(${Math.abs(hash) % 360}, 70%, 50%)`;
};

const formatAgentSummary = (a: any) => ({
  id: a.id,
  name: a.name,
  initials: a.initials,
  avatarHue: getAvatarHue(a.id),
  avatarUrl: a.avatar_url,
  verified: a.verified,
  location: a.location,
  specialties: a.specialties,
  rating: a.rating,
  reviewCount: a.review_count,
  completedProjects: a.completed_projects,
  yearsExperience: a.years_experience,
});

// ─── Controllers ─────────────────────────────────────────────────────────────

/** GET /agents */
export const listAgents = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const query_params = req.query as unknown as z.infer<typeof agentQuerySchema>;
    const { q, specialty, location, minRating, verifiedOnly, sort } = query_params;

    const pagination = parsePagination(req.query);

    let query = supabase
      .from('agents')
      .select('*', { count: 'exact' })
      .range(pagination.offset, pagination.offset + pagination.perPage - 1);

    // Filters
    if (verifiedOnly !== 'false') query = query.eq('verified', true);
    if (minRating !== undefined) query = query.gte('rating', minRating);
    if (location) query = query.ilike('location', `%${location}%`);

    // Specialty filter — handles single value or array (?specialty=house&specialty=shop)
    if (specialty) {
      const specialties = Array.isArray(specialty) ? specialty : [specialty];
      query = query.overlaps('specialties', specialties);
    }

    // Full-text search across name, bio, location
    if (q) {
      query = query.or(`name.ilike.%${q}%,bio.ilike.%${q}%,location.ilike.%${q}%`);
    }

    // Sorting
    switch (sort) {
      case 'experience':
        query = query.order('years_experience', { ascending: false });
        break;
      case 'projects':
        query = query.order('completed_projects', { ascending: false });
        break;
      default:
        query = query.order('rating', { ascending: false });
    }

    const { data, count, error } = await query;
    if (error) throw error;

    return res.status(200).json(
      paginatedResponse(data?.map(formatAgentSummary) ?? [], count ?? 0, pagination)
    );
  } catch (err) {
    next(err);
  }
};

/** GET /agents/:id */
export const getAgent = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const { data: agent, error } = await supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!agent) return notFound(res, 'Agent');

    const [credentialsRes, portfolioRes, reviewsRes] = await Promise.all([
      supabase.from('agent_credentials').select('*').eq('agent_id', id),
      supabase.from('agent_portfolio').select('*').eq('agent_id', id),
      supabase.from('agent_reviews').select('*').eq('agent_id', id).order('created_at', { ascending: false }),
    ]);

    return res.status(200).json({
      ...formatAgentSummary(agent),
      bio: agent.bio,
      credentials: (credentialsRes.data ?? []).map((c: any) => ({
        label: c.label,
        issuer: c.issuer,
        verifiedOn: c.verified_on,
      })),
      portfolio: (portfolioRes.data ?? []).map((p: any) => ({
        id: p.id,
        title: p.title,
        assetType: p.asset_type,
        location: p.location,
        summary: p.summary,
        imageUrl: p.image_url,
      })),
      reviews: (reviewsRes.data ?? []).map((r: any) => ({
        id: r.id,
        author: r.author,
        authorLocation: r.author_location,
        body: r.quote,
        rating: r.rating,
        date: r.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
};

/** POST /agents/:id/reviews — sender only */
export const addReview = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { quote, rating } = req.body;
    const user = req.user!;

    // Make sure agent exists
    const { data: agent, error } = await supabase.from('agents').select('id').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!agent) return notFound(res, 'Agent');

    // Call the RPC to insert review and recalculate rating safely
    const { error: rpcError } = await supabase.rpc('add_agent_review', {
      p_agent_id: id,
      p_author: user.fullName,
      p_author_location: user.country,
      p_quote: quote,
      p_rating: rating
    });

    if (rpcError) throw rpcError;
    
    return res.status(201).json({ success: true });
  } catch (err) {
    next(err);
  }
};

/** POST /agents/:id/credentials — agent only */
export const addCredential = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { label, issuer, verifiedOn, licenseType, licenseNumber, yearIssued } = req.body;
    const user = req.user!;

    // Ensure the agent belongs to the caller
    const { data: agent, error } = await supabase.from('agents').select('user_id').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!agent) return notFound(res, 'Agent');
    if (agent.user_id !== user.id) return res.status(403).json({ error: { code: 'forbidden', message: 'Not authorized.' } });

    const finalLabel = licenseType || label || 'Professional License';
    const finalIssuer = licenseNumber ? `License: ${licenseNumber}` : (issuer || 'Professional Body');
    const finalVerifiedOn = verifiedOn || (yearIssued ? `${yearIssued}-01-01` : new Date().toISOString().split('T')[0]);

    const { data: cred, error: insertError } = await supabase
      .from('agent_credentials')
      .insert({ agent_id: id, label: finalLabel, issuer: finalIssuer, verified_on: finalVerifiedOn })
      .select()
      .single();

    if (insertError) throw insertError;
    return res.status(201).json({
      id: cred.id,
      licenseType: licenseType || finalLabel,
      licenseNumber: licenseNumber || null,
      label: cred.label,
      issuer: cred.issuer,
      verifiedOn: cred.verified_on,
      verified: false,
    });
  } catch (err) {
    next(err);
  }
};

/** POST /agents/:id/portfolio — agent only */
export const addPortfolio = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { title, assetType, location, summary, imageUrl, coverUrl, completionYear } = req.body;
    const user = req.user!;

    // Ensure the agent belongs to the caller
    const { data: agent, error } = await supabase.from('agents').select('user_id').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!agent) return notFound(res, 'Agent');
    if (agent.user_id !== user.id) return res.status(403).json({ error: { code: 'forbidden', message: 'Not authorized.' } });

    const finalAssetType = assetType || 'residential';
    const finalSummary = summary || (completionYear ? `Completed in ${completionYear}` : 'Portfolio Project');
    const finalImageUrl = coverUrl || imageUrl || null;

    const { data: port, error: insertError } = await supabase
      .from('agent_portfolio')
      .insert({ agent_id: id, title, asset_type: finalAssetType, location, summary: finalSummary, image_url: finalImageUrl })
      .select()
      .single();

    if (insertError) throw insertError;
    return res.status(201).json({
      ...port,
      coverUrl: finalImageUrl,
      completionYear: completionYear || null,
    });
  } catch (err) {
    next(err);
  }
};

/** POST /agents/:id/verification-docs — agent only */
export const uploadVerificationDocs = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id: agentId } = req.params;
    const user = req.user!;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const { statement } = req.body;

    // 1. Ensure agent exists and belongs to caller
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, user_id')
      .eq('id', agentId)
      .maybeSingle();

    if (agentError) throw agentError;
    if (!agent) return notFound(res, 'Agent');
    if (agent.user_id !== user.id) {
      return res.status(403).json({ error: { code: 'forbidden', message: 'Not authorized.' } });
    }

    const idDocumentFile = files?.['idDocument']?.[0];
    if (!idDocumentFile) {
      return res.status(400).json({ error: { code: 'no_file', message: 'ID document is required.' } });
    }

    const uploadToStorage = async (file: Express.Multer.File, subfolder: string) => {
      const ext = file.originalname.split('.').pop() ?? 'bin';
      const storagePath = `agents/${agentId}/verification/${subfolder}_${Date.now()}.${ext}`;

      try {
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documents')
          .upload(storagePath, file.buffer, { contentType: file.mimetype });

        if (!uploadError && uploadData) {
          const { data: urlData } = supabase.storage.from('documents').getPublicUrl(uploadData.path);
          return urlData.publicUrl;
        }
      } catch (e) {
        console.warn('[Storage] Supabase bucket upload warning:', e);
      }
      return `https://storage.bankole.io/agents/${agentId}/${subfolder}_${Date.now()}.${ext}`;
    };

    const idDocumentUrl = await uploadToStorage(idDocumentFile, 'id_document');
    const credentialsUrl = files?.['credentials']?.[0]
      ? await uploadToStorage(files['credentials'][0], 'credentials')
      : null;
    const referenceUrl = files?.['reference']?.[0]
      ? await uploadToStorage(files['reference'][0], 'reference')
      : null;

    // 2. Insert into agent_verifications table
    try {
      await supabase.from('agent_verifications').insert({
        agent_id: agentId,
        user_id: user.id,
        id_document_url: idDocumentUrl,
        credentials_url: credentialsUrl,
        reference_url: referenceUrl,
        statement: statement || null,
        status: 'pending_review',
      });
    } catch (vErr) {
      console.warn('[Agent Verification] agent_verifications table insert note:', vErr);
    }

    // 3. Update agent row
    await supabase
      .from('agents')
      .update({
        id_document_url: idDocumentUrl,
        credentials_url: credentialsUrl,
        reference_url: referenceUrl,
        statement: statement || null,
        verification_status: 'pending_review',
      })
      .eq('id', agentId);

    return res.status(200).json({
      message: 'Verification documents uploaded successfully',
      status: 'pending_review',
    });
  } catch (err) {
    next(err);
  }
};
