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
  verifiedOnly: z.enum(['true', 'false']).optional().default('true'),
  sort: z.enum(['rating', 'experience', 'projects']).optional().default('rating'),
  page: z.coerce.number().optional(),
  perPage: z.coerce.number().optional(),
});

export const reviewAgentSchema = z.object({
  quote: z.string().min(10, 'Review must be at least 10 characters.'),
  rating: z.number().int().min(1).max(5),
});

export const addCredentialSchema = z.object({
  label: z.string().min(2),
  issuer: z.string().min(2),
  verifiedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
});

export const addPortfolioSchema = z.object({
  title: z.string().min(2),
  assetType: z.string(),
  location: z.string(),
  summary: z.string(),
  imageUrl: z.string().url().optional(),
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
    const { label, issuer, verifiedOn } = req.body;
    const user = req.user!;

    // Ensure the agent belongs to the caller
    const { data: agent, error } = await supabase.from('agents').select('user_id').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!agent) return notFound(res, 'Agent');
    if (agent.user_id !== user.id) return res.status(403).json({ error: { code: 'forbidden', message: 'Not authorized.' } });

    const { data: cred, error: insertError } = await supabase
      .from('agent_credentials')
      .insert({ agent_id: id, label, issuer, verified_on: verifiedOn })
      .select()
      .single();

    if (insertError) throw insertError;
    return res.status(201).json(cred);
  } catch (err) {
    next(err);
  }
};

/** POST /agents/:id/portfolio — agent only */
export const addPortfolio = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { title, assetType, location, summary, imageUrl } = req.body;
    const user = req.user!;

    // Ensure the agent belongs to the caller
    const { data: agent, error } = await supabase.from('agents').select('user_id').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!agent) return notFound(res, 'Agent');
    if (agent.user_id !== user.id) return res.status(403).json({ error: { code: 'forbidden', message: 'Not authorized.' } });

    const { data: port, error: insertError } = await supabase
      .from('agent_portfolio')
      .insert({ agent_id: id, title, asset_type: assetType, location, summary, image_url: imageUrl })
      .select()
      .single();

    if (insertError) throw insertError;
    return res.status(201).json(port);
  } catch (err) {
    next(err);
  }
};
