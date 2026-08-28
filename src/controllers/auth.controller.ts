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
  phoneNumber: z.string().optional(),
  companyName: z.string().optional(),
  bio: z.string().optional(),
  portfolioUrl: z.string().url('Must be a valid URL.').optional(),
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
  phoneNumber: z.string().optional(),
  currencyPreference: z.string().optional(),
  timezone: z.string().optional(),
  companyName: z.string().optional(),
  portfolioUrl: z.string().url('Must be a valid URL.').optional(),
  availabilityStatus: z.string().optional(),
});

export const preferencesSchema = z.object({
  emailNotifications: z.boolean().optional(),
  inAppAlerts: z.boolean().optional(),
  autoReleaseEscrow: z.enum(['never', '3days', '7days']).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters.'),
});

export const verifyTotpSchema = z.object({
  code: z.string().length(6, 'TOTP code must be 6 digits.'),
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
    phoneNumber: user.phone_number,
  },
});

// ─── Controllers ──────────────────────────────────────────────────────────────

/** POST /auth/register */
export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fullName, email, password, role, country, phoneNumber, companyName, bio, portfolioUrl } = req.body; // <--- AUGMENTED

    // 1. Create auth user in Supabase Auth
    let { data: signUpData, error: signUpError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (signUpError) {
      const isAlreadyExists =
        signUpError.message.toLowerCase().includes('already') ||
        (signUpError as any).code === 'email_exists' ||
        (signUpError as any).status === 422;

      if (isAlreadyExists) {
        // Check if this is an orphaned user (exists in auth.users but deleted from public.users)
        try {
          const { data: listData } = await supabase.auth.admin.listUsers();
          const existingAuth = listData?.users?.find(
            (u) => u.email?.toLowerCase() === email.toLowerCase()
          );

          if (existingAuth) {
            const { data: existingProfile } = await supabase
              .from('users')
              .select('id')
              .eq('id', existingAuth.id)
              .maybeSingle();

            if (!existingProfile) {
              // Clean up dangling auth.users entry and re-attempt creation
              await supabase.auth.admin.deleteUser(existingAuth.id);
              const retry = await supabase.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
              });

              if (!retry.error && retry.data.user) {
                signUpData = retry.data;
                signUpError = null;
              } else if (retry.error) {
                signUpError = retry.error;
              }
            }
          }
        } catch (cleanupErr) {
          console.warn('[Register] Orphan cleanup attempt failed:', cleanupErr);
        }
      }

      if (signUpError) {
        if (
          signUpError.message.toLowerCase().includes('already') ||
          (signUpError as any).code === 'email_exists' ||
          (signUpError as any).status === 422
        ) {
          return res.status(409).json(buildError('email_taken', 'An account with this email already exists.'));
        }
        throw signUpError;
      }
    }

    const authUser = signUpData?.user;
    if (!authUser) return res.status(500).json(buildError('signup_failed', 'Failed to create account.'));

    // 2. Insert profile into public users table (Added phone_number)
    const { error: insertError } = await supabase.from('users').insert({
      id: authUser.id,
      full_name: fullName,
      email,
      role,
      country,
      phone_number: phoneNumber || null, // <--- AUGMENTED
      created_at: new Date().toISOString(),
    });

    if (insertError) throw insertError;

    // 3. If role is agent, seed an agent record
    if (role === Role.AGENT) {
      const { error: agentError } = await supabase.from('agents').insert({
        user_id: authUser.id,
        name: fullName,
        initials: getInitials(fullName),
        bio: bio || null,
        location: country,
        specialties: [],
        rating: 0,
        review_count: 0,
        completed_projects: 0,
        years_experience: 0,
        verified: true,
        avatar_url: null,
        // New augmented defaults
        company_name: companyName || null,         // <--- AUGMENTED
        portfolio_url: portfolioUrl || null,        // <--- AUGMENTED
        availability_status: 'Available', // <--- AUGMENTED
      });
      if (agentError) throw agentError;
    }

    // 4. Sign in to get session tokens
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
        phone_number: phoneNumber || null, // <--- AUGMENTED
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
      .select('full_name, role, country, phone_number')
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
        phone_number: profile.phone_number,
      })
    );
  } catch (err) {
    next(err);
  }
};

/** GET /auth/me */
export const me = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { data: userProfile, error: userError } = await supabase
      .from('users')
      .select('id, full_name, email, role, country, phone_number, currency_preference, timezone, created_at')
      .eq('id', req.user!.id)
      .single();

    if (userError || !userProfile) {
      return res.status(404).json(buildError('not_found', 'User profile not found.'));
    }

    let responsePayload: any = {
      id: userProfile.id,
      fullName: userProfile.full_name,
      email: userProfile.email,
      role: userProfile.role,
      country: userProfile.country,
      phoneNumber: userProfile.phone_number,
      currencyPreference: userProfile.currency_preference,
      timezone: userProfile.timezone,
      createdAt: userProfile.created_at,
    };

    if (userProfile.role === Role.AGENT) {
      const { data: agentProfile } = await supabase
        .from('agents')
        .select(`
          bio, specialties, years_experience, avatar_url, verified, rating, review_count, completed_projects,
          company_name, portfolio_url, availability_status
        `)
        .eq('user_id', req.user!.id)
        .single();
      
      if (agentProfile) {
        responsePayload.agentDetails = {
          bio: agentProfile.bio,
          specialties: agentProfile.specialties,
          yearsExperience: agentProfile.years_experience,
          avatarUrl: agentProfile.avatar_url,
          verified: agentProfile.verified,
          rating: agentProfile.rating,
          reviewCount: agentProfile.review_count,
          completedProjects: agentProfile.completed_projects,
          companyName: agentProfile.company_name,
          portfolioUrl: agentProfile.portfolio_url,
          availabilityStatus: agentProfile.availability_status,
        };
      }
    }

    return res.status(200).json(responsePayload);
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
      .select('full_name, role, country, phone_number')
      .eq('id', data.user.id)
      .single();

    return res.status(200).json(
      formatTokenResponse(data.session, {
        id: data.user.id,
        email: data.user.email,
        full_name: profile?.full_name,
        role: profile?.role,
        country: profile?.country,
        phone_number: profile?.phone_number,
      })
    );
  } catch (err) {
    next(err);
  }
};

/** PATCH /auth/me */
export const updateProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // <--- AUGMENTED: Extracted all new fields from the request body
    const { 
      fullName, country, phoneNumber, currencyPreference, timezone, // Global
      bio, specialties, yearsExperience, avatarUrl, companyName, portfolioUrl, availabilityStatus // Agent-specific
    } = req.body;
    
    const userId = req.user!.id;
    const role = req.user!.role;

    let usersUpdated = false;
    let agentsUpdated = false;

    // 1. Update users table if any global fields are provided
    if (fullName || country || phoneNumber || currencyPreference || timezone) {
      const updates: any = {};
      if (fullName !== undefined) updates.full_name = fullName;
      if (country !== undefined) updates.country = country;
      if (phoneNumber !== undefined) updates.phone_number = phoneNumber; // <--- AUGMENTED
      if (currencyPreference !== undefined) updates.currency_preference = currencyPreference; // <--- AUGMENTED
      if (timezone !== undefined) updates.timezone = timezone; // <--- AUGMENTED
      
      const { error } = await supabase.from('users').update(updates).eq('id', userId);
      if (error) throw error;
      usersUpdated = true;
    }

    // 2. Update agents table if the user is an agent
    if (role === Role.AGENT) {
      const agentUpdates: any = {};
      if (fullName !== undefined) {
        agentUpdates.name = fullName;
        agentUpdates.initials = getInitials(fullName);
      }
      if (country !== undefined) agentUpdates.location = country;
      if (bio !== undefined) agentUpdates.bio = bio;
      if (specialties !== undefined) agentUpdates.specialties = specialties;
      if (yearsExperience !== undefined) agentUpdates.years_experience = yearsExperience;
      if (avatarUrl !== undefined) agentUpdates.avatar_url = avatarUrl;
      
      // <--- AUGMENTED: Agent specific additions
      if (companyName !== undefined) agentUpdates.company_name = companyName; 
      if (portfolioUrl !== undefined) agentUpdates.portfolio_url = portfolioUrl;
      if (availabilityStatus !== undefined) agentUpdates.availability_status = availabilityStatus;

      if (Object.keys(agentUpdates).length > 0) {
        const { error } = await supabase.from('agents').update(agentUpdates).eq('user_id', userId);
        if (error) throw error;
        agentsUpdated = true;
      }
    }

    // 3. Fetch the fully hydrated profile to return to the client
    const { data: userProfile, error: userError } = await supabase
      .from('users')
      .select('id, full_name, email, role, country, phone_number, currency_preference, timezone, created_at') // <--- AUGMENTED
      .eq('id', userId)
      .single();
    
    if (userError) throw userError;

    let responsePayload: any = {
      id: userProfile.id,
      fullName: userProfile.full_name,
      email: userProfile.email,
      role: userProfile.role,
      country: userProfile.country,
      phoneNumber: userProfile.phone_number, // <--- AUGMENTED
      currencyPreference: userProfile.currency_preference, // <--- AUGMENTED
      timezone: userProfile.timezone, // <--- AUGMENTED
      createdAt: userProfile.created_at,
    };

    // If they are an agent, grab the agent-specific data
    if (role === Role.AGENT) {
      const { data: agentProfile, error: agentError } = await supabase
        .from('agents')
        .select(`
          bio, specialties, years_experience, avatar_url, verified, rating, review_count, completed_projects,
          company_name, portfolio_url, availability_status
        `) // <--- AUGMENTED
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
          companyName: agentProfile.company_name, // <--- AUGMENTED
          portfolioUrl: agentProfile.portfolio_url, // <--- AUGMENTED
          availabilityStatus: agentProfile.availability_status, // <--- AUGMENTED
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

/** PATCH /auth/preferences */
export const updatePreferences = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { emailNotifications, inAppAlerts, autoReleaseEscrow } = req.body;
    const updates: any = {};
    if (emailNotifications !== undefined) updates.email_notifications = emailNotifications;
    if (inAppAlerts !== undefined) updates.in_app_alerts = inAppAlerts;
    if (autoReleaseEscrow !== undefined) updates.auto_release_escrow = autoReleaseEscrow;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json(buildError('no_fields', 'No preference fields provided.'));
    }

    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.user!.id);

    if (error) throw error;

    return res.status(200).json({ message: 'Preferences updated successfully.' });
  } catch (err) {
    next(err);
  }
};

/** POST /auth/password — change password */
export const changePassword = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const { createClient } = await import('@supabase/supabase-js');

    // Verify current password by attempting to sign in
    const authClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { error: signInError } = await authClient.auth.signInWithPassword({
      email: req.user!.email,
      password: currentPassword,
    });

    if (signInError) {
      return res.status(400).json(buildError('wrong_password', 'Current password is incorrect.'));
    }

    // Update password via Supabase Admin
    const { error: updateError } = await supabase.auth.admin.updateUserById(req.user!.id, {
      password: newPassword,
    });

    if (updateError) throw updateError;

    return res.status(200).json({ message: 'Password updated successfully.' });
  } catch (err) {
    next(err);
  }
};

/** POST /auth/2fa/enable */
export const enable2fa = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const speakeasy = await import('speakeasy');
    const speakeasyLib = speakeasy.default || speakeasy;

    const secret = speakeasyLib.generateSecret({
      name: `Bankole:${req.user!.email}`,
      issuer: 'Bankole',
    });

    // Store the pending secret in the users table
    const { error } = await supabase
      .from('users')
      .update({
        totp_secret: secret.base32,
        two_fa_pending: true,
        two_fa_enabled: false,
      })
      .eq('id', req.user!.id);

    if (error) throw error;

    const qrcode = await import('qrcode');
    const qrDataUrl = await qrcode.toDataURL(secret.otpauth_url!);

    return res.status(200).json({
      secret: secret.base32,
      qrCodeUrl: qrDataUrl,
    });
  } catch (err) {
    next(err);
  }
};

/** POST /auth/2fa/verify */
export const verify2fa = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { code } = req.body;
    const speakeasy = await import('speakeasy');

    // Fetch the stored TOTP secret
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('totp_secret, two_fa_pending')
      .eq('id', req.user!.id)
      .single();

    if (userError || !user) {
      return res.status(404).json(buildError('not_found', 'User not found.'));
    }

    if (!user.totp_secret || !user.two_fa_pending) {
      return res.status(400).json(buildError('2fa_not_initiated', '2FA setup has not been initiated. Call /auth/2fa/enable first.'));
    }

    const speakeasyLib = speakeasy.default || speakeasy;

    const isValid = speakeasyLib.totp.verify({
      secret: user.totp_secret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!isValid) {
      return res.status(400).json(buildError('invalid_totp', 'The TOTP code is invalid or has expired.'));
    }

    // Mark 2FA as fully enabled
    const { error: updateError } = await supabase
      .from('users')
      .update({ two_fa_enabled: true, two_fa_pending: false })
      .eq('id', req.user!.id);

    if (updateError) throw updateError;

    return res.status(200).json({ message: 'Two-factor authentication enabled successfully.' });
  } catch (err) {
    next(err);
  }
};
