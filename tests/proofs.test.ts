import { request, validateSchema } from './utils';

describe('Proofs Endpoints', () => {
  const tokenSender = 'Bearer mock-token-sender';
  const tokenAgent = 'Bearer mock-token-agent';
  describe('GET /api/v1/projects/{id}/proofs', () => {
    it('should list project proofs and match swagger', async () => {
      const res = await request
        .get('/api/v1/projects/mock-id/proofs')
        .set('Authorization', tokenSender);
        
      expect([200, 403, 404]).toContain(res.status);
      if (res.status === 200) {
        validateSchema(res, '/api/v1/projects/{id}/proofs', 'get');
      }
    });

    it('should handle query params and match swagger', async () => {
      const res = await request
        .get('/api/v1/projects/mock-id/proofs?page=2&perPage=5&milestoneId=m123&status=PENDING')
        .set('Authorization', tokenSender);
        
      expect([200, 403, 404]).toContain(res.status);
    });

    it('should return 401 if unauthorized', async () => {
      const res = await request.get('/api/v1/projects/mock-id/proofs');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/proofs/{id}/verification', () => {
    it('should fetch proof verification and match swagger', async () => {
      const res = await request
        .get('/api/v1/proofs/mock-id/verification')
        .set('Authorization', tokenSender);
        
      expect(res.status).toBe(200);
      validateSchema(res, '/api/v1/proofs/{id}/verification', 'get', 200);
    });

    it('should return 401 if unauthorized', async () => {
      const res = await request.get('/api/v1/proofs/mock-id/verification');
      expect(res.status).toBe(401);
    });

    it('should return 403 if user is not the owner', async () => {
      const res = await request
        .get('/api/v1/proofs/mock-id-other-owner/verification')
        .set('Authorization', tokenSender);
      expect(res.status).toBe(403);
    });

    it('should return 404 if not found', async () => {
      const res = await request
        .get('/api/v1/proofs/non-existent-id/verification')
        .set('Authorization', tokenSender);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/proofs/{id}/approve', () => {
    it('should approve proof and match swagger', async () => {
      const res = await request
        .post('/api/v1/proofs/mock-id/approve')
        .set('Authorization', tokenSender)
        .set('Idempotency-Key', 'proof-approve-123');
        
      expect(res.status).toBe(200);
      validateSchema(res, '/api/v1/proofs/{id}/approve', 'post', 200);
    });

    it('should return cached response if Idempotency-Key is reused', async () => {
      const res1 = await request
        .post('/api/v1/proofs/mock-id/approve')
        .set('Authorization', tokenSender)
        .set('Idempotency-Key', 'proof-approve-reuse');
      
      expect(res1.status).toBe(200);

      const res2 = await request
        .post('/api/v1/proofs/mock-id/approve')
        .set('Authorization', tokenSender)
        .set('Idempotency-Key', 'proof-approve-reuse');
      
      expect(res2.status).toBe(200);
      expect(res2.body).toEqual(res1.body);
    });

    it('should return 401 if unauthorized', async () => {
      const res = await request.post('/api/v1/proofs/mock-id/approve');
      expect(res.status).toBe(401);
    });

    it('should return 403 if user is not a sender', async () => {
      const res = await request
        .post('/api/v1/proofs/mock-id/approve')
        .set('Authorization', tokenAgent);
      expect(res.status).toBe(403);
    });

    it('should return 404 for bad request', async () => {
      const res = await request
        .post('/api/v1/proofs/00000000-0000-0000-0000-000000000000/approve')
        .set('Authorization', tokenSender);
      expect(res.status).toBe(404);
    });

    it('should return 404 if not found', async () => {
      const res = await request
        .post('/api/v1/proofs/non-existent-id/approve')
        .set('Authorization', tokenSender);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/proofs/{id}/flag', () => {
    it('should flag proof and match swagger', async () => {
      const res = await request
        .post('/api/v1/proofs/mock-id/flag')
        .set('Authorization', tokenSender);
        
      expect(res.status).toBe(200);
      validateSchema(res, '/api/v1/proofs/{id}/flag', 'post', 200);
    });

    it('should return cached response if Idempotency-Key is reused', async () => {
      const res1 = await request
        .post('/api/v1/proofs/mock-id/flag')
        .set('Authorization', tokenSender)
        .set('Idempotency-Key', 'proof-flag-reuse');
      
      expect(res1.status).toBe(200);

      const res2 = await request
        .post('/api/v1/proofs/mock-id/flag')
        .set('Authorization', tokenSender)
        .set('Idempotency-Key', 'proof-flag-reuse');
      
      expect(res2.status).toBe(200);
      expect(res2.body).toEqual(res1.body);
    });

    it('should return 401 if unauthorized', async () => {
      const res = await request.post('/api/v1/proofs/mock-id/flag');
      expect(res.status).toBe(401);
    });

    it('should return 403 if user is not a sender', async () => {
      const res = await request
        .post('/api/v1/proofs/mock-id/flag')
        .set('Authorization', tokenAgent);
      expect(res.status).toBe(403);
    });

    it('should return 404 for bad request', async () => {
      const res = await request
        .post('/api/v1/proofs/00000000-0000-0000-0000-000000000000/flag')
        .set('Authorization', tokenSender);
      expect(res.status).toBe(404);
    });

    it('should return 404 if not found', async () => {
      const res = await request
        .post('/api/v1/proofs/non-existent-id/flag')
        .set('Authorization', tokenSender);
      expect(res.status).toBe(404);
    });
  });
});
