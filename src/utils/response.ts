import { Response } from 'express';
import { ParsedPagination, PaginatedResponse } from '../types/api';

/**
 * Parses page and perPage from query params with safe defaults.
 */
export const parsePagination = (query: Record<string, any>): ParsedPagination => {
  const page = Math.max(1, parseInt(query.page as string, 10) || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(query.perPage as string, 10) || 20));
  return { page, perPage, offset: (page - 1) * perPage };
};

/**
 * Wraps an array result in the standard paginated envelope.
 */
export const paginatedResponse = <T>(
  data: T[],
  total: number,
  pagination: ParsedPagination
): PaginatedResponse<T> => ({
  data,
  meta: {
    page: pagination.page,
    perPage: pagination.perPage,
    total,
    totalPages: Math.ceil(total / pagination.perPage),
  },
});

/**
 * Builds a standard API error object.
 */
export const buildError = (
  code: string,
  message: string,
  field?: string,
  details?: Record<string, unknown>
) => ({
  error: { code, message, ...(field && { field }), ...(details && { details }) },
});

/**
 * Sends a 404 error response.
 */
export const notFound = (res: Response, resource = 'Resource') =>
  res.status(404).json(buildError('not_found', `${resource} not found.`));

/**
 * Sends a 403 error response.
 */
export const forbidden = (res: Response) =>
  res.status(403).json(buildError('forbidden', 'You do not have permission to access this resource.'));

/**
 * Sends a 409 conflict error response.
 */
export const conflict = (res: Response, code: string, message: string) =>
  res.status(409).json(buildError(code, message));

/**
 * Generates initials from a full name (e.g. "Ada Okafor" → "AO").
 */
export const getInitials = (name: string): string =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('');
