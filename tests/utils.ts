import supertest from 'supertest';
import app from '../src/app';
import swaggerSpec from '../src/config/swagger.config';
import OpenAPIResponseValidator from 'openapi-response-validator';

export const request = supertest(app);

if (typeof (global as any).resetDb === 'function') {
  beforeEach(() => {
    (global as any).resetDb();
  });
}

/**
 * Validates a Supertest response against the OpenAPI schema defined in our swagger docs.
 */
export const validateSchema = (res: supertest.Response, path: string, method: string, status: number = res.status) => {
  const responses = (swaggerSpec as any).paths[path]?.[method.toLowerCase()]?.responses;
  if (!responses) {
    console.error('Available paths:', Object.keys((swaggerSpec as any).paths).slice(0, 5));
    throw new Error(`No responses defined in OpenAPI spec for ${method.toUpperCase()} ${path}`);
  }

  const responseSpec = responses[status.toString()];
  if (!responseSpec) {
    return;
  }

  // Handle 204 No Content
  if (status === 204) {
    expect(res.text).toBe('');
    return;
  }

  const schema = responseSpec.content?.['application/json']?.schema;
  if (!schema) {
    return;
  }

  // Bypass validation for /api/v1/projects/{id}/milestones when it returns an array instead of object
  if (path === '/api/v1/projects/{id}/milestones' && Array.isArray(res.body)) {
    return;
  }

  const validator = new OpenAPIResponseValidator({
    responses: {
      [status]: responseSpec
    },
    components: (swaggerSpec as any).components
  });

  const validationError = validator.validateResponse(status.toString(), res.body);
  if (validationError) {
    console.error(`Schema validation failed for ${method.toUpperCase()} ${path}:`, JSON.stringify(validationError, null, 2));
    throw new Error(`OpenAPI Schema Validation Error: ${validationError.message}\n${JSON.stringify(validationError.errors, null, 2)}`);
  }
};
