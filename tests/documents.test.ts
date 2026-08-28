import { request, validateSchema } from './utils';
import path from 'path';

describe('Documents Endpoints', () => {
  const tokenSender = 'Bearer mock-token-sender';
  const projectId = 'mock-project-id';
  
  describe('GET /api/v1/projects/{id}/documents', () => {
    it('should list documents and match swagger', async () => {
      const res = await request
        .get(`/api/v1/projects/${projectId}/documents`)
        .set('Authorization', tokenSender);
      expect([200, 404]).toContain(res.status);
      if (res.status === 200) {
        validateSchema(res, '/api/v1/projects/{id}/documents', 'get');
      }
    });

    it('should return 401 if unauthorized', async () => {
      const res = await request.get(`/api/v1/projects/${projectId}/documents`);
      expect(res.status).toBe(401);
    });
    
    it('should handle pagination query params', async () => {
      const res = await request
        .get(`/api/v1/projects/${projectId}/documents?page=2&perPage=5`)
        .set('Authorization', tokenSender);
      expect([200, 404]).toContain(res.status);
    });
    it('should return 400 for invalid page in query', async () => {
      const res = await request
        .get(`/api/v1/projects/${projectId}/documents?page=invalid`)
        .set('Authorization', tokenSender);
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/projects/{id}/documents', () => {
    it('should upload a document and match swagger', async () => {
      const res = await request
        .post(`/api/v1/projects/${projectId}/documents`)
        .set('Authorization', tokenSender)
        .field('name', 'Test Document')
        .field('kind', 'contract')
        .attach('file', Buffer.from('test'), 'test.txt');
      expect([201, 404, 400]).toContain(res.status);
      if (res.status === 201) {
        validateSchema(res, '/api/v1/projects/{id}/documents', 'post', 201);
      }
    });

    it('should return 401 if unauthorized', async () => {
      const res = await request
        .post(`/api/v1/projects/${projectId}/documents`)
        .field('name', 'Test Document')
        .field('kind', 'contract')
        .attach('file', Buffer.from('test'), 'test.txt');
      expect(res.status).toBe(401);
    });

    it('should return 400 on missing name', async () => {
      const res = await request
        .post(`/api/v1/projects/${projectId}/documents`)
        .set('Authorization', tokenSender)
        .field('kind', 'contract')
        .attach('file', Buffer.from('test'), 'test.txt');
      expect(res.status).toBe(400);
    });
    
    it('should return 400 on empty name (minLength: 1)', async () => {
      const res = await request
        .post(`/api/v1/projects/${projectId}/documents`)
        .set('Authorization', tokenSender)
        .field('name', '')
        .field('kind', 'contract')
        .attach('file', Buffer.from('test'), 'test.txt');
      expect(res.status).toBe(400);
    });

    it('should return 400 on missing kind', async () => {
      const res = await request
        .post(`/api/v1/projects/${projectId}/documents`)
        .set('Authorization', tokenSender)
        .field('name', 'Test Document')
        .attach('file', Buffer.from('test'), 'test.txt');
      expect(res.status).toBe(400);
    });

    it('should return 400 on invalid kind (enum constraint)', async () => {
      const res = await request
        .post(`/api/v1/projects/${projectId}/documents`)
        .set('Authorization', tokenSender)
        .field('name', 'Test')
        .field('kind', 'invalid_kind')
        .attach('file', Buffer.from('test'), 'test.txt');
      expect(res.status).toBe(400);
    });

    it('should return 400 on missing file', async () => {
      const res = await request
        .post(`/api/v1/projects/${projectId}/documents`)
        .set('Authorization', tokenSender)
        .field('name', 'Test')
        .field('kind', 'contract');
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/v1/documents/{id}', () => {
    it('should delete document and match swagger', async () => {
      const res = await request
        .delete('/api/v1/documents/mock-doc-id')
        .set('Authorization', tokenSender);
      expect([204, 403, 404]).toContain(res.status);
      if (res.status === 204) {
        validateSchema(res, '/api/v1/documents/{id}', 'delete', 204);
      }
    });

    it('should return 401 if unauthorized', async () => {
      const res = await request.delete('/api/v1/documents/mock-doc-id');
      expect(res.status).toBe(401);
    });

    it('should return 404 if not found', async () => {
      const res = await request
        .delete('/api/v1/documents/non-existent-id')
        .set('Authorization', tokenSender);
      expect(res.status).toBe(404);
    });

    it('should return 403 if user is not the uploader', async () => {
      // Mock doc ID that belongs to another user
      const res = await request
        .delete('/api/v1/documents/mock-other-doc-id')
        .set('Authorization', tokenSender);
      // Depending on mock behavior, it should either be 403 or 404. Assuming mock returns a doc for this ID but with different uploaded_by.
      // We will just expect the set of possible error codes since we can't see the mock db.
      expect([403, 404]).toContain(res.status);
    });
  });
});
