import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.config';
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

export const updateProfileSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters.').optional(),
  country: z.string().length(2, 'Country must be an ISO 3166-1 alpha-2 code (e.g. GB, NG).').toUpperCase().optional(),
  bio: z.string().optional(),
  specialties: z.array(z.string()).optional(),
  yearsExperience: z.coerce.number().min(0).optional(),
  avatarUrl: z.string().url('Must be a valid URL.').optional(),
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

    // 1. Create auth user in Supabase Auth (using admin API to bypass rate limits and auto-confirm)
    const { data: signUpData, error: signUpError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
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
    // We use a temporary stateless client so we don't pollute the admin singleton's headers
    const authClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({ email, password });
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

    const authClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data, error } = await authClient.auth.signInWithPassword({ email, password });

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

    const authClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data, error } = await authClient.auth.refreshSession({ refresh_token: refreshToken });

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

/** PATCH /auth/me */
export const updateProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { fullName, country, bio, specialties, yearsExperience, avatarUrl } = req.body;
    const userId = req.user!.id;
    const role = req.user!.role;

    let usersUpdated = false;
    let agentsUpdated = false;

    // 1. Update users table if fullName or country provided
    if (fullName || country) {
      const updates: any = {};
      if (fullName) updates.full_name = fullName;
      if (country) updates.country = country;
      
      const { error } = await supabase.from('users').update(updates).eq('id', userId);
      if (error) throw error;
      usersUpdated = true;
    }

    // 2. Update agents table if the user is an agent
    if (role === Role.AGENT) {
      const agentUpdates: any = {};
      if (fullName) {
        agentUpdates.name = fullName;
        agentUpdates.initials = getInitials(fullName);
      }
      if (country) agentUpdates.location = country;
      if (bio !== undefined) agentUpdates.bio = bio;
      if (specialties !== undefined) agentUpdates.specialties = specialties;
      if (yearsExperience !== undefined) agentUpdates.years_experience = yearsExperience;
      if (avatarUrl !== undefined) agentUpdates.avatar_url = avatarUrl;

      // Only update if there are agent-specific fields to update
      if (Object.keys(agentUpdates).length > 0) {
        const { error } = await supabase.from('agents').update(agentUpdates).eq('user_id', userId);
        if (error) throw error;
        agentsUpdated = true;
      }
    }

    // 3. Fetch the fully hydrated profile to return to the client
    const { data: userProfile, error: userError } = await supabase
      .from('users')
      .select('id, full_name, email, role, country, created_at')
      .eq('id', userId)
      .single();
    
    if (userError) throw userError;

    let responsePayload: any = {
      id: userProfile.id,
      fullName: userProfile.full_name,
      email: userProfile.email,
      role: userProfile.role,
      country: userProfile.country,
      createdAt: userProfile.created_at,
    };

    // If they are an agent, grab the agent-specific data
    if (role === Role.AGENT) {
      const { data: agentProfile, error: agentError } = await supabase
        .from('agents')
        .select('bio, specialties, years_experience, avatar_url, verified, rating, review_count, completed_projects')
        .eq('user_id', userId)
        .single();
      
      if (agentError) throw agentError;
      
      responsePayload = {
        ...responsePayload,
        agentDetails: {
          bio: agentProfile.bio,
          specialties: agentProfile.specialties,
          yearsExperience: agentProfile.years_experience,
          avatarUrl: agentProfile.avatar_url,
          verified: agentProfile.verified,
          rating: agentProfile.rating,
          reviewCount: agentProfile.review_count,
          completedProjects: agentProfile.completed_projects,
        }
      };
    }

    return res.status(200).json({
      message: 'Profile updated successfully.',
      updatedFields: { usersUpdated, agentsUpdated },
      profile: responsePayload
    });
  } catch (err) {
    next(err);
  }
};
