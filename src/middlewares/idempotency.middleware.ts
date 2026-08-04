import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase.config';
import { buildError } from '../utils/response';

/**
 * Idempotency middleware for state-mutating endpoints (e.g. POST /milestones/:id/release).
 * Reads `Idempotency-Key` header, checks cache in Supabase, and returns the cached
 * response on replay — preventing double-releases and duplicate mutations.
 */
export const idempotency = async (req: Request, res: Response, next: NextFunction) => {
  const key = req.headers['idempotency-key'] as string | undefined;

  if (!key) return next(); // key is optional for endpoints that support it

  // Look up existing response for this key
  const { data: existing } = await supabase
    .from('idempotency_keys')
    .select('response')
    .eq('key', key)
    .maybeSingle();

  if (existing) {
    // Replay: return the cached response and stop processing
    const cached = JSON.parse(existing.response);
    return res.status(200).json(cached);
  }

  // Intercept the response so we can store it after sending
  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    // Only cache successful responses
    if (res.statusCode >= 200 && res.statusCode < 300) {
      supabase.from('idempotency_keys').insert({
        key,
        response: JSON.stringify(body),
        created_at: new Date().toISOString(),
      }).then(({ error }: { error: any }) => {
        if (error) console.error('[idempotency] Failed to store key:', error.message);
      });
    }
    return originalJson(body);
  };

  next();
};
