import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodSchema } from 'zod';
import { buildError } from '../utils/response';

/**
 * Generic Zod schema validation middleware factory.
 * Validates req.body and maps ZodError to the API error format with `field` populated.
 */
export const validate =
  (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const firstIssue = (result.error as ZodError).issues[0];
      const field = firstIssue?.path.join('.');
      res.status(400).json(
        buildError('validation_error', firstIssue?.message ?? 'Validation failed.', field)
      );
      return;
    }
    req.body = result.data;
    next();
  };

/**
 * Validates query parameters against a Zod schema.
 */
export const validateQuery =
  (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const firstIssue = (result.error as ZodError).issues[0];
      const field = firstIssue?.path.join('.');
      res.status(400).json(
        buildError('validation_error', firstIssue?.message ?? 'Validation failed.', field)
      );
      return;
    }
    req.query = result.data as any;
    next();
  };
