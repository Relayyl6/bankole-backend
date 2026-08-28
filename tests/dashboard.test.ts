import { request, validateSchema } from './utils';

describe('Dashboard Endpoints', () => {
  describe('GET /api/v1/dashboard/summary', () => {
    it('should get dashboard summary and match swagger', async () => {
      const res = await request
        .get('/api/v1/dashboard/summary')
        .set('Authorization', 'Bearer mock-token-sender');
      
      expect(res.status).toBe(200);
      validateSchema(res, '/api/v1/dashboard/summary', 'get');
    });

    it('should get dashboard summary for agent and match swagger', async () => {
      const res = await request
        .get('/api/v1/dashboard/summary')
        .set('Authorization', 'Bearer mock-token-agent');
      
      expect(res.status).toBe(200);
      validateSchema(res, '/api/v1/dashboard/summary', 'get');
    });

    it('should return 401 if unauthorized', async () => {
      const res = await request.get('/api/v1/dashboard/summary');
      expect(res.status).toBe(401);
    });

    it('should have the correct summary properties', async () => {
      const res = await request
        .get('/api/v1/dashboard/summary')
        .set('Authorization', 'Bearer mock-token-sender');
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('currency');
      expect(res.body).toHaveProperty('projectCount');
      expect(res.body).toHaveProperty('totalBudget');
      expect(res.body).toHaveProperty('totalReleased');
      expect(res.body).toHaveProperty('totalInEscrow');
      expect(res.body).toHaveProperty('awaitingYourReview');
      expect(res.body).toHaveProperty('attentionNeeded');
      expect(res.body).toHaveProperty('recentActivity');
    });

    it('should return recentActivity as an array', async () => {
      const res = await request
        .get('/api/v1/dashboard/summary')
        .set('Authorization', 'Bearer mock-token-sender');
      
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.recentActivity)).toBe(true);
    });

    it('should handle users with no projects gracefully', async () => {
      const { supabase } = require('../src/config/supabase.config');
      const originalFrom = supabase.from;
      supabase.from = jest.fn((table: string) => {
        if (table === 'projects') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ data: [], error: null })
          };
        }
        return originalFrom(table);
      });
      
      const res = await request
        .get('/api/v1/dashboard/summary')
        .set('Authorization', 'Bearer mock-token-sender');
      
      expect(res.status).toBe(200);
      expect(res.body.projectCount).toBe(0);
      expect(res.body.recentActivity.length).toBe(0);
      
      supabase.from = originalFrom;
    });
  });
});
