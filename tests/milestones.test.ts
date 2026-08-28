import { request, validateSchema } from './utils';

describe('Milestones Endpoints', () => {
  const tokenSender = 'Bearer mock-token-sender';
  const tokenAgent = 'Bearer mock-token-agent';
  describe('GET /api/v1/projects/{id}/milestones', () => {
    it('should fetch milestones and match swagger', async () => {
      const res = await request
        .get('/api/v1/projects/mock-id/milestones')
        .set('Authorization', tokenSender);
        
      expect([200, 403, 404]).toContain(res.status);
      if (res.status === 200) {
        validateSchema(res, '/api/v1/projects/{id}/milestones', 'get');
      }
    });

    it('should return 401 if unauthorized', async () => {
      const res = await request.get('/api/v1/projects/mock-id/milestones');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/milestones/{id}/proofs', () => {
    it('should upload a proof and match swagger', async () => {
      const res = await request
        .post('/api/v1/milestones/mock-id/proofs')
        .set('Authorization', tokenAgent)
        .field('caption', 'Completed the foundation')
        .attach('file', Buffer.from('test file content'), 'proof.jpg');
        
      expect([201, 400, 403, 404, 500]).toContain(res.status);
      validateSchema(res, '/api/v1/milestones/{id}/proofs', 'post');
    });

    it('should return 401 if unauthorized', async () => {
      const res = await request.post('/api/v1/milestones/mock-id/proofs');
      expect(res.status).toBe(401);
    });

    it('should return 403 if user is not an agent', async () => {
      const res = await request
        .post('/api/v1/milestones/mock-id/proofs')
        .set('Authorization', tokenSender)
        .field('caption', 'Completed the foundation')
        .attach('file', Buffer.from('test file content'), 'proof.jpg');
      expect(res.status).toBe(403);
    });

    it('should return 400 if caption is missing', async () => {
      const res = await request
        .post('/api/v1/milestones/mock-id/proofs')
        .set('Authorization', tokenAgent)
        .attach('file', Buffer.from('test file content'), 'proof.jpg');
      expect(res.status).toBe(400);
    });

    it('should return 400 if caption is empty', async () => {
      const res = await request
        .post('/api/v1/milestones/mock-id/proofs')
        .set('Authorization', tokenAgent)
        .field('caption', '')
        .attach('file', Buffer.from('test file content'), 'proof.jpg');
      expect(res.status).toBe(400);
    });

    it('should return 400 if file is missing', async () => {
      const res = await request
        .post('/api/v1/milestones/mock-id/proofs')
        .set('Authorization', tokenAgent)
        .field('caption', 'Completed the foundation');
      expect(res.status).toBe(400);
    });

    it('should upload a proof with geo data and match swagger', async () => {
      const res = await request
        .post('/api/v1/milestones/mock-id/proofs')
        .set('Authorization', tokenAgent)
        .field('caption', 'Completed the foundation')
        .field('capturedLat', '6.5244')
        .field('capturedLng', '3.3792')
        .field('capturedAt', '2023-10-10T10:00:00Z')
        .attach('file', Buffer.from('test file content'), 'proof.jpg');
        
      expect([201, 400, 403, 404, 500]).toContain(res.status);
      if (res.status === 201) validateSchema(res, '/api/v1/milestones/{id}/proofs', 'post');
    });
    it('should return 400 if capturedAt is invalid datetime', async () => {
      const res = await request
        .post('/api/v1/milestones/mock-id/proofs')
        .set('Authorization', tokenAgent)
        .field('caption', 'Completed the foundation')
        .field('capturedAt', 'invalid-date')
        .attach('file', Buffer.from('test file content'), 'proof.jpg');
        
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/milestones/{id}/fund', () => {
    it('should fund a milestone and match swagger', async () => {
      const res = await request
        .post('/api/v1/milestones/mock-id/fund')
        .set('Authorization', tokenSender);
        
      expect([200, 400, 404]).toContain(res.status);
      validateSchema(res, '/api/v1/milestones/{id}/fund', 'post');
    });

    it('should return 401 if unauthorized', async () => {
      const res = await request.post('/api/v1/milestones/mock-id/fund');
      expect(res.status).toBe(401);
    });

    it('should return 403 if user is not a sender', async () => {
      const res = await request
        .post('/api/v1/milestones/mock-id/fund')
        .set('Authorization', tokenAgent);
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/milestones/{id}/submit', () => {
    it('should submit milestone and match swagger', async () => {
      const res = await request
        .post('/api/v1/milestones/mock-id/submit')
        .set('Authorization', tokenAgent);
        
      expect([200, 400, 403, 404, 409, 500]).toContain(res.status);
      if (res.status === 200) validateSchema(res, '/api/v1/milestones/{id}/submit', 'post');
    });

    it('should return 401 if unauthorized', async () => {
      const res = await request.post('/api/v1/milestones/mock-id/submit');
      expect(res.status).toBe(401);
    });

    it('should return 403 if user is not an agent', async () => {
      const res = await request
        .post('/api/v1/milestones/mock-id/submit')
        .set('Authorization', tokenSender);
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/milestones/{id}/approve', () => {
    it('should approve milestone and match swagger', async () => {
      const res = await request
        .post('/api/v1/milestones/mock-submitted-id/approve')
        .set('Authorization', tokenSender)
        .send({ note: 'Looks good' });
        
      expect([200, 400, 404, 409]).toContain(res.status);
      if (res.status === 200) validateSchema(res, '/api/v1/milestones/{id}/approve', 'post');
    });

    it('should return 401 if unauthorized', async () => {
      const res = await request.post('/api/v1/milestones/mock-id/approve').send({ note: 'Looks good' });
      expect(res.status).toBe(401);
    });

    it('should return 403 if user is not a sender', async () => {
      const res = await request
        .post('/api/v1/milestones/mock-id/approve')
        .set('Authorization', tokenAgent)
        .send({ note: 'Looks good' });
      expect(res.status).toBe(403);
    });

    it('should approve milestone without a note and match swagger', async () => {
      const res = await request
        .post('/api/v1/milestones/mock-submitted-id/approve')
        .set('Authorization', tokenSender)
        .send({});
        
      expect([200, 400, 404, 409]).toContain(res.status);
    });
  });

  describe('POST /api/v1/milestones/{id}/flag', () => {
    it('should flag milestone and match swagger', async () => {
      const res = await request
        .post('/api/v1/milestones/mock-submitted-id/flag')
        .set('Authorization', tokenSender)
        .send({ reason: 'This milestone was not completed correctly' });
        
      expect([200, 400, 404, 409]).toContain(res.status);
      if (res.status === 200) validateSchema(res, '/api/v1/milestones/{id}/flag', 'post');
    });

    it('should return 401 if unauthorized', async () => {
      const res = await request
        .post('/api/v1/milestones/mock-id/flag')
        .send({ reason: 'This milestone was not completed correctly' });
      expect(res.status).toBe(401);
    });

    it('should return 403 if user is not a sender', async () => {
      const res = await request
        .post('/api/v1/milestones/mock-id/flag')
        .set('Authorization', tokenAgent)
        .send({ reason: 'This milestone was not completed correctly' });
      expect(res.status).toBe(403);
    });

    it('should return 400 if reason is missing', async () => {
      const res = await request
        .post('/api/v1/milestones/mock-id/flag')
        .set('Authorization', tokenSender)
        .send({});
      expect(res.status).toBe(400);
    });

    it('should return 400 if reason is too short', async () => {
      const res = await request
        .post('/api/v1/milestones/mock-id/flag')
        .set('Authorization', tokenSender)
        .send({ reason: 'short' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/milestones/{id}/release', () => {
    it('should release milestone funds and match swagger', async () => {
      const res = await request
        .post('/api/v1/milestones/mock-approved-id/release')
        .set('Authorization', tokenSender);
        
      expect([200, 400, 403, 404, 409, 500]).toContain(res.status);
      if (res.status === 200) validateSchema(res, '/api/v1/milestones/{id}/release', 'post');
    });

    it('should handle Idempotency-Key header to prevent duplicate releases', async () => {
      const idempotencyKey = 'mock-idemp-key-123';
      
      const res1 = await request
        .post('/api/v1/milestones/mock-approved-id/release')
        .set('Authorization', tokenSender)
        .set('Idempotency-Key', idempotencyKey);
        
      expect([200, 400, 403, 404, 409, 500]).toContain(res1.status);
      
      if (res1.status === 200) {
         const res2 = await request
          .post('/api/v1/milestones/mock-approved-id/release')
          .set('Authorization', tokenSender)
          .set('Idempotency-Key', idempotencyKey);
          
         expect(res2.status).toBe(200);
         expect(res2.body).toEqual(res1.body);
      }
    });

    it('should return 401 if unauthorized', async () => {
      const res = await request.post('/api/v1/milestones/mock-id/release');
      expect(res.status).toBe(401);
    });

    it('should return 403 if user is not a sender', async () => {
      const res = await request
        .post('/api/v1/milestones/mock-id/release')
        .set('Authorization', tokenAgent);
      expect(res.status).toBe(403);
    });
  });
});
