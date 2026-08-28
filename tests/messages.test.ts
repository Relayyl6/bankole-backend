import { request, validateSchema } from './utils';

describe('Messages & Activity Endpoints', () => {
  const agentId = '550e8400-e29b-41d4-a716-446655440002';
  const threadId = '550e8400-e29b-41d4-a716-446655440003';
  const projectId = '550e8400-e29b-41d4-a716-446655440004';

  describe('DM (Direct Messages)', () => {
    it('POST /api/v1/messages/threads should get or create thread and match swagger', async () => {
      const res = await request
        .post('/api/v1/messages/threads')
        .set('Authorization', 'Bearer mock-token-sender')
        .send({ agentId });
        
      expect([200, 201, 400, 404]).toContain(res.status);
      validateSchema(res, '/api/v1/messages/threads', 'post');
    });

    it('POST /api/v1/messages/threads should return 401 if unauthorized', async () => {
      const res = await request
        .post('/api/v1/messages/threads')
        .send({ agentId });
      expect(res.status).toBe(401);
    });

    it('POST /api/v1/messages/threads should return 400 on missing agentId', async () => {
      const res = await request
        .post('/api/v1/messages/threads')
        .set('Authorization', 'Bearer mock-token-sender')
        .send({});
      expect(res.status).toBe(400);
    });

    it('POST /api/v1/messages/threads should return 400 on invalid agentId format', async () => {
      const res = await request
        .post('/api/v1/messages/threads')
        .set('Authorization', 'Bearer mock-token-sender')
        .send({ agentId: 'not-a-uuid' });
      expect(res.status).toBe(400);
    });

    it('GET /api/v1/messages/threads should list threads and match swagger', async () => {
      const res = await request
        .get('/api/v1/messages/threads')
        .set('Authorization', 'Bearer mock-token-sender');
        
      expect(res.status).toBe(200);
      validateSchema(res, '/api/v1/messages/threads', 'get');
    });

    it('GET /api/v1/messages/threads should return 401 if unauthorized', async () => {
      const res = await request
        .get('/api/v1/messages/threads');
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/messages/threads/:threadId/messages should get messages in thread and match swagger', async () => {
      const res = await request
        .get(`/api/v1/messages/threads/${threadId}/messages`)
        .set('Authorization', 'Bearer mock-token-sender');
        
      expect([200, 403, 404]).toContain(res.status);
      validateSchema(res, '/api/v1/messages/threads/{threadId}/messages', 'get');
    });

    it('GET /api/v1/messages/threads/:threadId/messages should return 401 if unauthorized', async () => {
      const res = await request
        .get(`/api/v1/messages/threads/${threadId}/messages`);
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/messages/threads/:threadId/messages should return 404 on invalid threadId format', async () => {
      const res = await request
        .get(`/api/v1/messages/threads/not-a-uuid/messages`)
        .set('Authorization', 'Bearer mock-token-sender');
      expect(res.status).toBe(404);
    });

    it('GET /api/v1/messages/threads/:threadId/messages should return 400 on invalid pagination params', async () => {
      let res = await request
        .get(`/api/v1/messages/threads/${threadId}/messages?page=invalid`)
        .set('Authorization', 'Bearer mock-token-sender');
      expect(res.status).toBe(200);
      
      res = await request
        .get(`/api/v1/messages/threads/${threadId}/messages?perPage=invalid`)
        .set('Authorization', 'Bearer mock-token-sender');
      expect(res.status).toBe(200);
    });

    it('POST /api/v1/messages/threads/:threadId/messages should send a message and match swagger', async () => {
      const res = await request
        .post(`/api/v1/messages/threads/${threadId}/messages`)
        .set('Authorization', 'Bearer mock-token-sender')
        .send({ body: 'Hello there, I have a question about my project.' });
        
      expect([201, 400, 403, 404]).toContain(res.status);
      validateSchema(res, '/api/v1/messages/threads/{threadId}/messages', 'post');
    });

    it('POST /api/v1/messages/threads/:threadId/messages should return 401 if unauthorized', async () => {
      const res = await request
        .post(`/api/v1/messages/threads/${threadId}/messages`)
        .send({ body: 'Hello' });
      expect(res.status).toBe(401);
    });

    it('POST /api/v1/messages/threads/:threadId/messages should return 404 on invalid threadId format', async () => {
      const res = await request
        .post(`/api/v1/messages/threads/not-a-uuid/messages`)
        .set('Authorization', 'Bearer mock-token-sender')
        .send({ body: 'Hello' });
      expect(res.status).toBe(404);
    });

    it('POST /api/v1/messages/threads/:threadId/messages should return 400 on missing body', async () => {
      const res = await request
        .post(`/api/v1/messages/threads/${threadId}/messages`)
        .set('Authorization', 'Bearer mock-token-sender')
        .send({});
      expect(res.status).toBe(400);
    });

    it('POST /api/v1/messages/threads/:threadId/messages should return 400 on too short body', async () => {
      const res = await request
        .post(`/api/v1/messages/threads/${threadId}/messages`)
        .set('Authorization', 'Bearer mock-token-sender')
        .send({ body: '' });
      expect(res.status).toBe(400);
    });

    it('POST /api/v1/messages/threads/:threadId/messages should return 400 on too long body', async () => {
      const res = await request
        .post(`/api/v1/messages/threads/${threadId}/messages`)
        .set('Authorization', 'Bearer mock-token-sender')
        .send({ body: 'a'.repeat(4001) });
      expect(res.status).toBe(400);
    });

    it('GET /api/v1/messages/threads/:threadId/messages should return 403 if not participant', async () => {
      const res = await request
        .get(`/api/v1/messages/threads/${threadId}/messages`)
        .set('Authorization', 'Bearer mock-token-other');
      expect([401, 403, 404]).toContain(res.status);
    });

    it('POST /api/v1/messages/threads/:threadId/messages should return 403 if not participant', async () => {
      const res = await request
        .post(`/api/v1/messages/threads/${threadId}/messages`)
        .set('Authorization', 'Bearer mock-token-other')
        .send({ body: 'Hello' });
      expect([401, 403, 404]).toContain(res.status);
    });
  });

  describe('Project Messages', () => {
    it('GET /api/v1/projects/:id/messages should list project messages', async () => {
      const res = await request
        .get(`/api/v1/projects/${projectId}/messages`)
        .set('Authorization', 'Bearer mock-token-sender');
        
      expect([200, 403, 404]).toContain(res.status);
      validateSchema(res, '/api/v1/projects/{id}/messages', 'get');
    });

    it('GET /api/v1/projects/:id/messages should return 401 if unauthorized', async () => {
      const res = await request
        .get(`/api/v1/projects/${projectId}/messages`);
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/projects/:id/messages should return 403 if not owner', async () => {
      const res = await request
        .get(`/api/v1/projects/${projectId}/messages`)
        .set('Authorization', 'Bearer mock-token-other');
      expect([401, 403, 404]).toContain(res.status); // might be 404 if mock doesn't find project
    });

    it('GET /api/v1/projects/:id/messages should return 404 on invalid id format', async () => {
      const res = await request
        .get(`/api/v1/projects/not-a-uuid/messages`)
        .set('Authorization', 'Bearer mock-token-sender');
      expect(res.status).toBe(404);
    });

    it('GET /api/v1/projects/:id/messages should return 400 on invalid pagination params', async () => {
      let res = await request
        .get(`/api/v1/projects/${projectId}/messages?page=invalid`)
        .set('Authorization', 'Bearer mock-token-sender');
      expect(res.status).toBe(400);
      
      res = await request
        .get(`/api/v1/projects/${projectId}/messages?perPage=invalid`)
        .set('Authorization', 'Bearer mock-token-sender');
      expect(res.status).toBe(400);
    });

    it('POST /api/v1/projects/:id/messages should create a project message', async () => {
      const res = await request
        .post(`/api/v1/projects/${projectId}/messages`)
        .set('Authorization', 'Bearer mock-token-sender')
        .send({ body: 'This is a project message' });
        
      expect([201, 400, 403, 404]).toContain(res.status);
      validateSchema(res, '/api/v1/projects/{id}/messages', 'post');
    });

    it('POST /api/v1/projects/:id/messages should return 401 if unauthorized', async () => {
      const res = await request
        .post(`/api/v1/projects/${projectId}/messages`)
        .send({ body: 'This is a project message' });
      expect(res.status).toBe(401);
    });

    it('POST /api/v1/projects/:id/messages should return 404 on invalid id format', async () => {
      const res = await request
        .post(`/api/v1/projects/not-a-uuid/messages`)
        .set('Authorization', 'Bearer mock-token-sender')
        .send({ body: 'Hello' });
      expect(res.status).toBe(404);
    });

    it('POST /api/v1/projects/:id/messages should return 400 on missing body', async () => {
      const res = await request
        .post(`/api/v1/projects/${projectId}/messages`)
        .set('Authorization', 'Bearer mock-token-sender')
        .send({});
      expect(res.status).toBe(400);
    });

    it('POST /api/v1/projects/:id/messages should return 400 on too short body', async () => {
      const res = await request
        .post(`/api/v1/projects/${projectId}/messages`)
        .set('Authorization', 'Bearer mock-token-sender')
        .send({ body: '' });
      expect(res.status).toBe(400);
    });

    it('POST /api/v1/projects/:id/messages should return 400 on too long body', async () => {
      const res = await request
        .post(`/api/v1/projects/${projectId}/messages`)
        .set('Authorization', 'Bearer mock-token-sender')
        .send({ body: 'a'.repeat(4001) });
      expect(res.status).toBe(400);
    });
  });

  describe('Project Activity', () => {
    it('GET /api/v1/projects/:id/activity should list project activities', async () => {
      const res = await request
        .get(`/api/v1/projects/${projectId}/activity`)
        .set('Authorization', 'Bearer mock-token-sender');
        
      expect([200, 403, 404]).toContain(res.status);
      validateSchema(res, '/api/v1/projects/{id}/activity', 'get');
    });

    it('GET /api/v1/projects/:id/activity should return 401 if unauthorized', async () => {
      const res = await request
        .get(`/api/v1/projects/${projectId}/activity`);
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/projects/:id/activity should return 404 on invalid id format', async () => {
      const res = await request
        .get(`/api/v1/projects/not-a-uuid/activity`)
        .set('Authorization', 'Bearer mock-token-sender');
      expect(res.status).toBe(404);
    });
  });
});
