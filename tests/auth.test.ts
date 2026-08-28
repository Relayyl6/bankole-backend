import { request, validateSchema } from './utils';

describe('Auth Endpoints', () => {
  describe('POST /api/v1/auth/register', () => {
    it('should register a user and match swagger', async () => {
      const res = await request.post('/api/v1/auth/register').send({
        fullName: 'Test Sender',
        email: 'test@example.com',
        password: 'password123',
        role: 'sender',
        country: 'NG',
        phoneNumber: '+2341234567890',
        companyName: 'Test Inc',
        bio: 'I am a test sender',
        portfolioUrl: 'https://test.com'
      });
      expect(res.status).toBe(201);
      validateSchema(res, '/api/v1/auth/register', 'post');
    });

    it('should register an agent user', async () => {
      const res = await request.post('/api/v1/auth/register').send({
        fullName: 'Test Agent',
        email: 'agent@example.com',
        password: 'password123',
        role: 'agent',
        country: 'NG',
      });
      expect(res.status).toBe(201);
    });

    it('should return 400 for missing fields', async () => {
      const res = await request.post('/api/v1/auth/register').send({
        email: 'test@example.com',
        password: 'password123'
      });
      expect(res.status).toBe(400);
    });

    it('should return 400 for password too short', async () => {
      const res = await request.post('/api/v1/auth/register').send({
        fullName: 'Test Sender',
        email: 'test@example.com',
        password: 'short',
        role: 'sender',
        country: 'NG'
      });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid role', async () => {
      const res = await request.post('/api/v1/auth/register').send({
        fullName: 'Test Sender',
        email: 'test@example.com',
        password: 'password123',
        role: 'admin',
        country: 'NG'
      });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid country code length', async () => {
      const res = await request.post('/api/v1/auth/register').send({
        fullName: 'Test Sender',
        email: 'test@example.com',
        password: 'password123',
        role: 'sender',
        country: 'NGA'
      });
      expect(res.status).toBe(400);
    });

    it('should return 400 for fullName too short', async () => {
      const res = await request.post('/api/v1/auth/register').send({
        fullName: 'A',
        email: 'test@example.com',
        password: 'password123',
        role: 'sender',
        country: 'NG'
      });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid email format', async () => {
      const res = await request.post('/api/v1/auth/register').send({
        fullName: 'Test Sender',
        email: 'invalid-email',
        password: 'password123',
        role: 'sender',
        country: 'NG'
      });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid portfolioUrl format', async () => {
      const res = await request.post('/api/v1/auth/register').send({
        fullName: 'Test Sender',
        email: 'test@example.com',
        password: 'password123',
        role: 'sender',
        country: 'NG',
        portfolioUrl: 'invalid-url'
      });
      expect(res.status).toBe(400);
    });

    it('should return 409 if email already exists', async () => {
      const { supabase } = require('../src/config/supabase.config');
      const originalCreateUser = supabase.auth.admin.createUser;
      supabase.auth.admin.createUser = jest.fn().mockResolvedValue({
        data: { user: null },
        error: { message: 'User already exists', code: 'email_exists', status: 422 }
      });
      const res = await request.post('/api/v1/auth/register').send({
        fullName: 'Test Sender',
        email: 'exists@example.com',
        password: 'password123',
        role: 'sender',
        country: 'NG'
      });
      expect(res.status).toBe(409);
      supabase.auth.admin.createUser = originalCreateUser; // restore
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login a user and match swagger', async () => {
      const res = await request.post('/api/v1/auth/login').send({
        email: 'test@example.com',
        password: 'password123'
      });
      expect(res.status).toBe(200);
      validateSchema(res, '/api/v1/auth/login', 'post');
    });

    it('should return 400 for missing credentials', async () => {
      const res = await request.post('/api/v1/auth/login').send({
        email: 'test@example.com'
      });
      expect(res.status).toBe(400);
    });

    it('should return 401 for invalid credentials', async () => {
      const res = await request.post('/api/v1/auth/login').send({
        email: 'wrong@example.com',
        password: 'wrongpassword'
      });
      expect(res.status).toBe(401);
    });

    it('should return 400 for invalid email format', async () => {
      const res = await request.post('/api/v1/auth/login').send({
        email: 'invalid-email',
        password: 'password123'
      });
      expect(res.status).toBe(400);
    });

    it('should return 400 for empty password', async () => {
      const res = await request.post('/api/v1/auth/login').send({
        email: 'test@example.com',
        password: ''
      });
      expect(res.status).toBe(400);
    });

    it('should return 401 if profile not found', async () => {
      const { supabase } = require('../src/config/supabase.config');
      const originalFrom = supabase.from;
      // Mock 'users' table to return null for this test
      supabase.from = jest.fn((table: string) => {
        if (table === 'users') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Row not found' } })
          };
        }
        return originalFrom(table);
      });
      const res = await request.post('/api/v1/auth/login').send({
        email: 'test@example.com',
        password: 'password123'
      });
      expect(res.status).toBe(401);
      supabase.from = originalFrom; // restore
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should fetch profile and match swagger', async () => {
      const res = await request
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer mock-token-sender');
      expect(res.status).toBe(200);
      validateSchema(res, '/api/v1/auth/me', 'get');
    });

    it('should return 401 if not authorized', async () => {
      const res = await request.get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });

    it('should fetch agent profile with agentDetails', async () => {
      const res = await request
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer mock-token-agent');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('agentDetails');
    });
  });

  describe('PATCH /api/v1/auth/me', () => {
    it('should update profile and match swagger', async () => {
      const res = await request
        .patch('/api/v1/auth/me')
        .set('Authorization', 'Bearer mock-token-sender')
        .send({
          fullName: 'Updated Name',
          phoneNumber: '+2348012345678',
          currencyPreference: 'USD',
          timezone: 'Africa/Lagos'
        });
      expect(res.status).toBe(200);
      validateSchema(res, '/api/v1/auth/me', 'patch');
    });

    it('should update agent profile with agent-specific fields', async () => {
      const res = await request
        .patch('/api/v1/auth/me')
        .set('Authorization', 'Bearer mock-token-agent')
        .send({
          companyName: 'Agent Inc',
          portfolioUrl: 'https://agent.com',
          availabilityStatus: 'Busy',
          bio: 'Agent bio here',
          specialties: ['plumbing'],
          yearsExperience: 5
        });
      expect(res.status).toBe(200);
    });

    it('should return 401 if not authorized', async () => {
      const res = await request.patch('/api/v1/auth/me').send({ fullName: 'Updated Name' });
      expect(res.status).toBe(401);
    });

    it('should return 400 for invalid body', async () => {
      const res = await request
        .patch('/api/v1/auth/me')
        .set('Authorization', 'Bearer mock-token-sender')
        .send({ phoneNumber: 123 });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid yearsExperience minimum', async () => {
      const res = await request
        .patch('/api/v1/auth/me')
        .set('Authorization', 'Bearer mock-token-sender')
        .send({ yearsExperience: -1 });
      expect(res.status).toBe(400);
    });

    it('should return 400 for fullName too short', async () => {
      const res = await request
        .patch('/api/v1/auth/me')
        .set('Authorization', 'Bearer mock-token-sender')
        .send({ fullName: 'A' });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid country code length', async () => {
      const res = await request
        .patch('/api/v1/auth/me')
        .set('Authorization', 'Bearer mock-token-sender')
        .send({ country: 'NGA' });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid avatarUrl format', async () => {
      const res = await request
        .patch('/api/v1/auth/me')
        .set('Authorization', 'Bearer mock-token-sender')
        .send({ avatarUrl: 'invalid-url' });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid portfolioUrl format', async () => {
      const res = await request
        .patch('/api/v1/auth/me')
        .set('Authorization', 'Bearer mock-token-sender')
        .send({ portfolioUrl: 'invalid-url' });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid specialties type', async () => {
      const res = await request
        .patch('/api/v1/auth/me')
        .set('Authorization', 'Bearer mock-token-sender')
        .send({ specialties: [1, 2, 3] });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should refresh token and match swagger', async () => {
      const res = await request
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken: 'mock-refresh-token'
        });
      expect(res.status).toBe(200);
      validateSchema(res, '/api/v1/auth/refresh', 'post');
    });

    it('should return 400 if refresh token is missing', async () => {
      const res = await request.post('/api/v1/auth/refresh').send({});
      expect(res.status).toBe(400);
    });

    it('should return 400 for empty refresh token', async () => {
      const res = await request.post('/api/v1/auth/refresh').send({
        refreshToken: ''
      });
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/v1/auth/preferences', () => {
    it('should update preferences and match swagger', async () => {
      const res = await request
        .patch('/api/v1/auth/preferences')
        .set('Authorization', 'Bearer mock-token-sender')
        .send({
          emailNotifications: true,
          inAppAlerts: false
        });
      expect(res.status).toBe(200);
      validateSchema(res, '/api/v1/auth/preferences', 'patch');
    });

    it('should return 401 if not authorized', async () => {
      const res = await request.patch('/api/v1/auth/preferences').send({ emailNotifications: true });
      expect(res.status).toBe(401);
    });

    it('should return 400 for invalid autoReleaseEscrow enum', async () => {
      const res = await request
        .patch('/api/v1/auth/preferences')
        .set('Authorization', 'Bearer mock-token-sender')
        .send({
          autoReleaseEscrow: 'invalid'
        });
      expect(res.status).toBe(400);
    });

    it('should return 400 if no preference fields provided', async () => {
      const res = await request
        .patch('/api/v1/auth/preferences')
        .set('Authorization', 'Bearer mock-token-sender')
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/password', () => {
    it('should change password and match swagger', async () => {
      const res = await request
        .post('/api/v1/auth/password')
        .set('Authorization', 'Bearer mock-token-sender')
        .send({
          currentPassword: 'password123',
          newPassword: 'newpassword123'
        });
      expect(res.status).toBe(200);
      validateSchema(res, '/api/v1/auth/password', 'post');
    });

    it('should return 400 for missing fields', async () => {
      const res = await request
        .post('/api/v1/auth/password')
        .set('Authorization', 'Bearer mock-token-sender')
        .send({ currentPassword: 'password123' });
      expect(res.status).toBe(400);
    });

    it('should return 401 if not authorized', async () => {
      const res = await request
        .post('/api/v1/auth/password')
        .send({
          currentPassword: 'password123',
          newPassword: 'newpassword123'
        });
      expect(res.status).toBe(401);
    });

    it('should return 400 for newPassword too short', async () => {
      const res = await request
        .post('/api/v1/auth/password')
        .set('Authorization', 'Bearer mock-token-sender')
        .send({
          currentPassword: 'password123',
          newPassword: 'short'
        });
      expect(res.status).toBe(400);
    });

    it('should return 400 for empty currentPassword', async () => {
      const res = await request
        .post('/api/v1/auth/password')
        .set('Authorization', 'Bearer mock-token-sender')
        .send({
          currentPassword: '',
          newPassword: 'newpassword123'
        });
      expect(res.status).toBe(400);
    });

    it('should return 400 if currentPassword is incorrect', async () => {
      const res = await request
        .post('/api/v1/auth/password')
        .set('Authorization', 'Bearer mock-token-sender')
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword123'
        });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/2fa/enable', () => {
    it('should enable 2fa and match swagger', async () => {
      const res = await request
        .post('/api/v1/auth/2fa/enable')
        .set('Authorization', 'Bearer mock-token-sender');
      expect(res.status).toBe(200);
      validateSchema(res, '/api/v1/auth/2fa/enable', 'post');
    });

    it('should return 401 if not authorized', async () => {
      const res = await request.post('/api/v1/auth/2fa/enable');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/2fa/verify', () => {
    it('should verify 2fa and match swagger', async () => {
      const res = await request
        .post('/api/v1/auth/2fa/verify')
        .set('Authorization', 'Bearer mock-token-sender')
        .send({ code: '123456' });
      expect(res.status).toBe(200);
      validateSchema(res, '/api/v1/auth/2fa/verify', 'post');
    });

    it('should return 400 if code is missing', async () => {
      const res = await request
        .post('/api/v1/auth/2fa/verify')
        .set('Authorization', 'Bearer mock-token-sender')
        .send({});
      expect(res.status).toBe(400);
    });

    it('should return 401 if not authorized', async () => {
      const res = await request
        .post('/api/v1/auth/2fa/verify')
        .send({ code: '123456' });
      expect(res.status).toBe(401);
    });

    it('should return 400 for invalid code length', async () => {
      const res = await request
        .post('/api/v1/auth/2fa/verify')
        .set('Authorization', 'Bearer mock-token-sender')
        .send({ code: '12345' });
      expect(res.status).toBe(400);
    });

    it('should return 400 for code too long', async () => {
      const res = await request
        .post('/api/v1/auth/2fa/verify')
        .set('Authorization', 'Bearer mock-token-sender')
        .send({ code: '1234567' });
      expect(res.status).toBe(400);
    });

    it('should return 400 if 2FA has not been initiated', async () => {
      // Create a scenario where two_fa_pending is false
      const { supabase } = require('../src/config/supabase.config');
      const originalFrom = supabase.from;
      supabase.from = jest.fn((table: string) => {
        if (table === 'users') {
          const mockBuilder: any = {
            select: jest.fn(() => mockBuilder),
            eq: jest.fn(() => mockBuilder),
            update: jest.fn(() => mockBuilder),
            single: jest.fn().mockResolvedValue({ data: { totp_secret: 'secret', two_fa_pending: false }, error: null }),
            maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'mock-user-id', role: 'sender' }, error: null })
          };
          return mockBuilder;
        }
        return originalFrom(table);
      });
      require('speakeasy');
      const res = await request
        .post('/api/v1/auth/2fa/verify')
        .set('Authorization', 'Bearer mock-token-sender')
        .send({ code: '123456' });
      if (res.status === 500) console.error(res.body);
      supabase.from = originalFrom;
      expect(res.status).toBe(400);
    });

    it('should return 400 if TOTP code is invalid', async () => {
      const speakeasy = require('speakeasy');
      const speakeasyLib = speakeasy.default || speakeasy;
      const originalVerify = speakeasyLib.totp.verify;
      speakeasyLib.totp.verify = jest.fn().mockReturnValue(false);
      
      const res = await request
        .post('/api/v1/auth/2fa/verify')
        .set('Authorization', 'Bearer mock-token-sender')
        .send({ code: '654321' });
      if (res.status === 500) console.error(res.body);
      expect(res.status).toBe(400);
      
      // restore
      speakeasyLib.totp.verify = originalVerify;
    });
  });
});
