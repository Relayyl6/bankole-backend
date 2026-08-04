import rateLimit from 'express-rate-limit';
import { buildError } from '../utils/response';

const rateLimitHandler = (_req: any, res: any) => {
  res.status(429).json(
    buildError('rate_limited', 'Too many requests. Please slow down and try again later.')
  );
};

/** Global rate limiter — 200 requests per 15 minutes */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/** Tight limiter for auth endpoints — 20 requests per 15 minutes */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/** File upload limiter — 30 uploads per 15 minutes */
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});
