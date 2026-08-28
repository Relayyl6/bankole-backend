import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.config';
import { buildError } from '../utils/response';

export const errorHandler = (err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('🔥 ACTUAL ERROR:', err);

  // Multer errors (file console.error('🔥 ACTUAL ERROR:', err);upload issues)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json(buildError('file_too_large', 'File exceeds the maximum allowed size of 100 MB.'));
  }

  const statusCode: number = err.statusCode ?? 500;
  const code: string = err.code ?? 'internal_server_error';
  const message: string =
    statusCode === 500 && env.NODE_ENV === 'production'
      ? 'An unexpected error occurred.'
      : err.message ?? 'Internal Server Error';

  const payload: Record<string, any> = buildError(code, message);

  if (env.NODE_ENV === 'development' && err.stack) {
    payload.error.stack = err.stack;
  }

  return res.status(statusCode).json(payload);
};

/** Handles requests to routes that do not exist. */
export const notFoundHandler = (_req: Request, res: Response) => {
  res.status(404).json(buildError('not_found', 'The requested endpoint does not exist.'));
};
