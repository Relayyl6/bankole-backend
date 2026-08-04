import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase.config';
import { buildError } from '../utils/response';
import { Role } from '../types/enums';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: Role;
    fullName: string;
  };
}

/**
 * Verifies the Bearer token against Supabase Auth and attaches the full user
 * profile (including role) to req.user.
 */
export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json(buildError('unauthorized', 'Missing or malformed Authorization header.'));
    }

    const token = authHeader.split(' ')[1];
    const { data: authData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authData.user) {
      return res.status(401).json(buildError('unauthorized', 'Invalid or expired token.'));
    }

    // Fetch the role and profile from our users table
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('full_name, role')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return res.status(401).json(buildError('unauthorized', 'User profile not found.'));
    }

    req.user = {
      id: authData.user.id,
      email: authData.user.email!,
      role: profile.role as Role,
      fullName: profile.full_name,
    };

    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Middleware factory — restricts an endpoint to a specific role.
 * Returns 403 for authenticated users with the wrong role.
 */
export const requireRole =
  (...roles: Role[]) =>
  (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json(buildError('forbidden', 'You do not have permission to perform this action.'));
    }
    next();
  };
