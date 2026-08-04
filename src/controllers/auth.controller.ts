import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase.config';
import { AuthRequest } from '../middlewares/auth.middleware';
import { buildError, getInitials } from '../utils/response';
import { Role } from '../types/enums';

// ─── Schemas ────────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters.'),
  email: z.string().email('A valid email address is required.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  role: z.enum([Role.SENDER, Role.AGENT], { message: 'Role must be sender or agent.' }),
  country: z.string().length(2, 'Country must be an ISO 3166-1 alpha-2 code (e.g. GB, NG).').toUpperCase(),
});

export const loginSchema = z.object({
  email: z.string().email('A valid email address is required.'),
  password: z.string().min(1, 'Password is required.'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required.'),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatTokenResponse = (session: any, user: any) => ({
  accessToken: session.access_token,
  refreshToken: session.refresh_token,
  expiresIn: session.expires_in,
  user: {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
    country: user.country,
  },
});

// ─── Controllers ──────────────────────────────────────────────────────────────

/** POST /auth/register */
export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fullName, email, password, role, country } = req.body;

    // 1. Create auth user in Supabase Auth
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      if (signUpError.message.toLowerCase().includes('already registered')) {
        return res.status(409).json(buildError('email_taken', 'An account with this email already exists.'));
      }
      throw signUpError;
    }

    const authUser = signUpData.user;
    if (!authUser) return res.status(500).json(buildError('signup_failed', 'Failed to create account.'));

    // 2. Insert profile into public users table
    const { error: insertError } = await supabase.from('users').insert({
      id: authUser.id,
      full_name: fullName,
      email,
      role,
      country,
      created_at: new Date().toISOString(),
    });

    if (insertError) throw insertError;

    // 3. If role is agent, seed an agent record
    if (role === Role.AGENT) {
      await supabase.from('agents').insert({
        user_id: authUser.id,
        name: fullName,
        initials: getInitials(fullName),
        bio: null,
        location: country,
        specialties: [],
        rating: 0,
        review_count: 0,
        completed_projects: 0,
        years_experience: 0,
        verified: false,
        avatar_url: null,
      });
    }

    // 4. Sign in to get session tokens
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError || !signInData.session) throw signInError ?? new Error('Login after register failed.');

    return res.status(201).json(
      formatTokenResponse(signInData.session, {
        id: authUser.id,
        full_name: fullName,
        email,
        role,
        country,
      })
    );
  } catch (err) {
    next(err);
  }
};

/** POST /auth/login */
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.session || !data.user) {
      return res.status(401).json(buildError('invalid_credentials', 'Invalid email or password.'));
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('full_name, role, country')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      return res.status(401).json(buildError('profile_not_found', 'User profile not found.'));
    }

    return res.status(200).json(
      formatTokenResponse(data.session, {
        id: data.user.id,
        email: data.user.email,
        full_name: profile.full_name,
        role: profile.role,
        country: profile.country,
      })
    );
  } catch (err) {
    next(err);
  }
};

/** GET /auth/me */
export const me = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { data: profile, error } = await supabase
      .from('users')
      .select('id, full_name, email, role, country')
      .eq('id', req.user!.id)
      .single();

    if (error || !profile) {
      return res.status(404).json(buildError('not_found', 'User profile not found.'));
    }

    return res.status(200).json({
      id: profile.id,
      fullName: profile.full_name,
      email: profile.email,
      role: profile.role,
      country: profile.country,
    });
  } catch (err) {
    next(err);
  }
};

/** POST /auth/refresh */
export const refresh = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;

    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });

    if (error || !data.session || !data.user) {
      return res.status(401).json(buildError('invalid_refresh_token', 'The refresh token is invalid or expired.'));
    }

    const { data: profile } = await supabase
      .from('users')
      .select('full_name, role, country')
      .eq('id', data.user.id)
      .single();

    return res.status(200).json(
      formatTokenResponse(data.session, {
        id: data.user.id,
        email: data.user.email,
        full_name: profile?.full_name,
        role: profile?.role,
        country: profile?.country,
      })
    );
  } catch (err) {
    next(err);
  }
};
