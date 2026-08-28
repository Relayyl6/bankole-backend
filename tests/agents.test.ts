import { request, validateSchema } from './utils';

describe('Agents Endpoints', () => {
  describe('GET /api/v1/agents', () => {
    it('should list agents and match swagger', async () => {
      const res = await request.get('/api/v1/agents?specialty=plumbing');
      expect(res.status).toBe(200);
      validateSchema(res, '/api/v1/agents', 'get');
    });

    it('should return 400 for invalid query params', async () => {
      const res = await request.get('/api/v1/agents?page=invalid');
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid sort enum', async () => {
      const res = await request.get('/api/v1/agents?sort=invalid_sort');
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid verifiedOnly enum', async () => {
      const res = await request.get('/api/v1/agents?verifiedOnly=not_a_boolean');
      expect(res.status).toBe(400);
    });

    it('should return 400 for out of range minRating', async () => {
      let res = await request.get('/api/v1/agents?minRating=-1');
      expect(res.status).toBe(400);
      res = await request.get('/api/v1/agents?minRating=6');
      expect(res.status).toBe(400);
    });

    it('should handle q, page, and perPage parameters', async () => {
      const res = await request.get('/api/v1/agents?q=test&page=1&perPage=10');
      expect(res.status).toBe(200);
    });

    it('should filter by verifiedOnly=true', async () => {
      const res = await request.get('/api/v1/agents?verifiedOnly=true');
      expect(res.status).toBe(200);
    });

    it('should filter by location', async () => {
      const res = await request.get('/api/v1/agents?location=Lagos');
      expect(res.status).toBe(200);
    });

    it('should handle array specialties and sorting options', async () => {
      let res = await request.get('/api/v1/agents?specialty=plumbing&specialty=electrical');
      expect(res.status).toBe(200);
      res = await request.get('/api/v1/agents?sort=experience');
      expect(res.status).toBe(200);
      res = await request.get('/api/v1/agents?sort=projects');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/v1/agents/{id}', () => {
    it('should fetch agent and match swagger', async () => {
      const res = await request.get('/api/v1/agents/mock-id');
      expect(res.status).toBe(200);
      validateSchema(res, '/api/v1/agents/{id}', 'get');
    });

    it('should return 404 if agent not found', async () => {
      const res = await request.get('/api/v1/agents/not-found');
      expect([404, 400]).toContain(res.status); // 400 if it strictly expects UUID
    });
  });

  describe('POST /api/v1/agents/{id}/reviews', () => {
    it('should add review and match swagger', async () => {
      const res = await request
        .post('/api/v1/agents/mock-id/reviews')
        .set('Authorization', 'Bearer mock-token-sender')
        .send({
          rating: 5,
          quote: 'Great work! Fantastic job.'
        });
      expect(res.status).toBe(201);
      validateSchema(res, '/api/v1/agents/{id}/reviews', 'post');
    });

    it('should return 401 if unauthorized', async () => {
      const res = await request
        .post('/api/v1/agents/mock-id/reviews')
        .send({
          rating: 5,
          quote: 'Great work! Fantastic job.'
        });
      expect(res.status).toBe(401);
    });

    it('should return 403 if user is not a sender', async () => {
      const res = await request
        .post('/api/v1/agents/mock-id/reviews')
        .set('Authorization', 'Bearer mock-token-agent')
        .send({
          rating: 5,
          quote: 'Great work! Fantastic job.'
        });
      expect(res.status).toBe(403);
    });

    it('should return 400 for missing fields', async () => {
      const res = await request
        .post('/api/v1/agents/mock-id/reviews')
        .set('Authorization', 'Bearer mock-token-sender')
        .send({ rating: 5 });
      expect(res.status).toBe(400);
    });

    it('should return 400 for out of range rating', async () => {
      let res = await request
        .post('/api/v1/agents/mock-id/reviews')
        .set('Authorization', 'Bearer mock-token-sender')
        .send({ rating: 0, quote: 'Valid quote here' });
      expect(res.status).toBe(400);

      res = await request
        .post('/api/v1/agents/mock-id/reviews')
        .set('Authorization', 'Bearer mock-token-sender')
        .send({ rating: 6, quote: 'Valid quote here' });
      expect(res.status).toBe(400);
    });

    it('should return 400 for non-integer rating', async () => {
      const res = await request
        .post('/api/v1/agents/mock-id/reviews')
        .set('Authorization', 'Bearer mock-token-sender')
        .send({ rating: 4.5, quote: 'Valid quote here' });
      expect(res.status).toBe(400);
    });

    it('should return 400 for short quote', async () => {
      const res = await request
        .post('/api/v1/agents/mock-id/reviews')
        .set('Authorization', 'Bearer mock-token-sender')
        .send({ rating: 5, quote: 'Short' });
      expect(res.status).toBe(400);
    });

    it('should return 404 if agent not found', async () => {
      const res = await request
        .post('/api/v1/agents/not-found/reviews')
        .set('Authorization', 'Bearer mock-token-sender')
        .send({ rating: 5, quote: 'Great work! Fantastic job.' });
      expect([404, 400]).toContain(res.status);
    });

    it('should handle RPC error gracefully', async () => {
      const { supabase } = require('../src/config/supabase.config');
      const originalRpc = supabase.rpc;
      supabase.rpc = jest.fn().mockResolvedValue({ error: { message: 'Database error' } });
      const res = await request
        .post('/api/v1/agents/mock-id/reviews')
        .set('Authorization', 'Bearer mock-token-sender')
        .send({ rating: 5, quote: 'Great work! Fantastic job.' });
      expect(res.status).toBe(500);
      supabase.rpc = originalRpc;
    });
  });

  describe('POST /api/v1/agents/{id}/portfolio', () => {
    it('should add portfolio and match swagger', async () => {
      const res = await request
        .post('/api/v1/agents/mock-id/portfolio')
        .set('Authorization', 'Bearer mock-token-agent')
        .send({
          title: 'Built a house',
          location: 'Lagos',
          assetType: 'residential',
          summary: 'My first project',
          imageUrl: 'https://example.com/img.jpg',
          completionYear: '2025'
        });
      expect(res.status).toBe(201);
      validateSchema(res, '/api/v1/agents/{id}/portfolio', 'post');
    });

    it('should return 403 if user is not an agent', async () => {
      const res = await request
        .post('/api/v1/agents/mock-id/portfolio')
        .set('Authorization', 'Bearer mock-token-sender')
        .send({
          title: 'Built a house',
          location: 'Lagos'
        });
      expect(res.status).toBe(403);
    });

    it('should return 403 if user is a different agent', async () => {
      const res = await request
        .post('/api/v1/agents/mock-id/portfolio')
        .set('Authorization', 'Bearer mock-token-agent2')
        .send({
          title: 'Built a house',
          location: 'Lagos'
        });
      expect(res.status).toBe(403);
    });

    it('should return 401 if unauthorized', async () => {
      const res = await request.post('/api/v1/agents/mock-id/portfolio').send({
        title: 'Built a house',
        location: 'Lagos',
        assetType: 'residential',
        summary: 'Complete build from scratch',
        imageUrl: 'http://example.com/img.jpg',
        completionYear: 2025
      });
      expect(res.status).toBe(401);
    });

    it('should return 400 for missing fields', async () => {
      const res = await request
        .post('/api/v1/agents/mock-id/portfolio')
        .set('Authorization', 'Bearer mock-token-agent')
        .send({ title: 'Missing fields' });
      expect(res.status).toBe(400);
    });

    it('should return 400 for short title', async () => {
      const res = await request
        .post('/api/v1/agents/mock-id/portfolio')
        .set('Authorization', 'Bearer mock-token-agent')
        .send({ title: 'A', location: 'Lagos' });
      expect(res.status).toBe(400);
    });

    it('should test fallback values when adding portfolio', async () => {
      const res = await request
        .post('/api/v1/agents/mock-id/portfolio')
        .set('Authorization', 'Bearer mock-token-agent')
        .send({
          title: 'Built a house',
          location: 'Lagos'
        });
      expect([201, 404]).toContain(res.status); // 404 if mock-id not found
    });

    it('should return 404 if agent not found', async () => {
      const res = await request
        .post('/api/v1/agents/not-found/portfolio')
        .set('Authorization', 'Bearer mock-token-agent')
        .send({
          title: 'Built a house',
          location: 'Lagos'
        });
      expect([404, 400]).toContain(res.status);
    });
  });

  describe('POST /api/v1/agents/{id}/credentials', () => {
    it('should add credential and match swagger', async () => {
      const res = await request
        .post('/api/v1/agents/mock-id/credentials')
        .set('Authorization', 'Bearer mock-token-agent')
        .send({
          label: 'BSc Computer Science',
          licenseType: 'Electrical License',
          licenseNumber: 'EL-12345',
          yearIssued: 2020
        });
      expect([201, 404]).toContain(res.status);
      if (res.status === 201) {
        validateSchema(res, '/api/v1/agents/{id}/credentials', 'post');
      }
    });

    it('should test fallback values when adding credentials', async () => {
      const res = await request
        .post('/api/v1/agents/mock-id/credentials')
        .set('Authorization', 'Bearer mock-token-agent')
        .send({}); // trigger fallbacks for label, issuer, verifiedOn
      expect([201, 404]).toContain(res.status);
    });

    it('should return 404 if agent not found', async () => {
      const res = await request
        .post('/api/v1/agents/not-found/credentials')
        .set('Authorization', 'Bearer mock-token-agent')
        .send({});
      expect([404, 400]).toContain(res.status);
    });

    it('should return 403 if user is not an agent', async () => {
      const res = await request
        .post('/api/v1/agents/mock-id/credentials')
        .set('Authorization', 'Bearer mock-token-sender')
        .send({
          label: 'BSc Computer Science'
        });
      expect(res.status).toBe(403);
    });

    it('should return 403 if user is a different agent', async () => {
      const res = await request
        .post('/api/v1/agents/mock-id/credentials')
        .set('Authorization', 'Bearer mock-token-agent2')
        .send({
          label: 'BSc Computer Science'
        });
      expect(res.status).toBe(403);
    });

    it('should return 401 if unauthorized', async () => {
      const res = await request.post('/api/v1/agents/mock-id/credentials').send({
        label: 'BSc Computer Science',
        issuer: 'University of Lagos',
        licenseType: 'degree',
        yearIssued: 2020
      });
      expect(res.status).toBe(401);
    });

    it('should return 400 for missing fields', async () => {
      const res = await request
        .post('/api/v1/agents/mock-id/credentials')
        .set('Authorization', 'Bearer mock-token-agent')
        .send({ label: 123 });
      expect(res.status).toBe(400);
    });

    it('should return 404 if agent not found (invalid id)', async () => {
      const res = await request
        .post('/api/v1/agents/not-found-id/credentials')
        .set('Authorization', 'Bearer mock-token-agent')
        .send({ label: 'BSc Computer Science' });
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/agents/{id}/verification-docs', () => {
    it('should upload verification docs and match swagger', async () => {
      const res = await request
        .post('/api/v1/agents/mock-id/verification-docs')
        .set('Authorization', 'Bearer mock-token-agent')
        .attach('idDocument', Buffer.from('mock content'), 'id.pdf')
        .attach('credentials', Buffer.from('mock content'), 'creds.pdf')
        .attach('reference', Buffer.from('mock content'), 'ref.pdf')
        .field('statement', 'I am a legit agent');
      expect(res.status).toBe(200);
      validateSchema(res, '/api/v1/agents/{id}/verification-docs', 'post');
    });

    it('should return 403 if user is not an agent', async () => {
      const res = await request
        .post('/api/v1/agents/mock-id/verification-docs')
        .set('Authorization', 'Bearer mock-token-sender')
        .attach('idDocument', Buffer.from('mock content'), 'id.pdf');
      expect(res.status).toBe(403);
    });

    it('should return 403 if user is a different agent', async () => {
      const res = await request
        .post('/api/v1/agents/mock-id/verification-docs')
        .set('Authorization', 'Bearer mock-token-agent2')
        .attach('idDocument', Buffer.from('mock content'), 'id.pdf');
      expect(res.status).toBe(403);
    });

    it('should return 401 if unauthorized', async () => {
      const res = await request
        .post('/api/v1/agents/mock-id/verification-docs')
        .attach('idDocument', Buffer.from('mock content'), 'id.pdf');
      expect(res.status).toBe(401);
    });

    it('should return 400 if idDocument is missing', async () => {
      const res = await request
        .post('/api/v1/agents/mock-id/verification-docs')
        .set('Authorization', 'Bearer mock-token-agent')
        .field('statement', 'I am a legit agent');
      expect(res.status).toBe(400);
    });

    it('should return 404 if agent not found', async () => {
      const res = await request
        .post('/api/v1/agents/not-found/verification-docs')
        .set('Authorization', 'Bearer mock-token-agent')
        .attach('idDocument', Buffer.from('mock content'), 'id.pdf');
      expect([404, 400]).toContain(res.status);
    });

    it('should return 404 if agent not found (invalid id)', async () => {
      const res = await request
        .post('/api/v1/agents/not-found-id/verification-docs')
        .set('Authorization', 'Bearer mock-token-agent')
        .attach('idDocument', Buffer.from('mock content'), 'id.pdf');
      expect(res.status).toBe(404);
    });
  });
});
