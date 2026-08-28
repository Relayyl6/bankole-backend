import { request, validateSchema } from './utils';

describe('Projects Endpoints', () => {
  const tokenSender = 'Bearer mock-token-sender';
  const tokenAgent = 'Bearer mock-token-agent';

  it('GET /api/v1/projects should list projects and match swagger', async () => {
    const res = await request.get('/api/v1/projects').set('Authorization', tokenSender);
    expect(res.status).toBe(200);
    validateSchema(res, '/api/v1/projects', 'get');
  });

  it('GET /api/v1/projects with query params should match swagger', async () => {
    const res = await request
      .get('/api/v1/projects')
      .query({ page: 1, perPage: 10, status: 'on_track', assetType: 'house', search: 'test', includeMarketplace: 'true' })
      .set('Authorization', tokenSender);
    expect(res.status).toBe(200);
    validateSchema(res, '/api/v1/projects', 'get');
  });

  it('GET /api/v1/projects should return 400 for invalid assetType in query', async () => {
    const res = await request
      .get('/api/v1/projects')
      .query({ assetType: 'invalid_asset' })
      .set('Authorization', tokenSender);
    expect(res.status).toBe(400);
  });

  it('GET /api/v1/projects should return 400 for invalid includeMarketplace in query', async () => {
    const res = await request
      .get('/api/v1/projects')
      .query({ includeMarketplace: 'invalid' })
      .set('Authorization', tokenSender);
    expect(res.status).toBe(400);
  });

  it('GET /api/v1/projects should return 400 for invalid page and perPage in query', async () => {
    const res = await request
      .get('/api/v1/projects')
      .query({ page: 'invalid', perPage: 'invalid' })
      .set('Authorization', tokenSender);
    expect(res.status).toBe(400);
  });

  it('GET /api/v1/projects should ignore or handle invalid status gracefully', async () => {
    const res = await request
      .get('/api/v1/projects')
      .query({ status: 'invalid_status_string_that_should_not_exist' })
      .set('Authorization', tokenSender);
    expect([200, 400]).toContain(res.status);
  });

  it('GET /api/v1/projects/{id}/activity should return 400 for invalid page in query', async () => {
    const res = await request
      .get('/api/v1/projects/mock-id/activity')
      .query({ page: 'invalid' })
      .set('Authorization', tokenSender);
    expect(res.status).toBe(400);
  });

  it('GET /api/v1/projects/{id}/proofs should return 400 for invalid page in query', async () => {
    const res = await request
      .get('/api/v1/projects/mock-id/proofs')
      .query({ page: 'invalid' })
      .set('Authorization', tokenSender);
    expect(res.status).toBe(400);
  });

  it('GET /api/v1/projects/{id}/documents should return 400 for invalid page in query', async () => {
    const res = await request
      .get('/api/v1/projects/mock-id/documents')
      .query({ page: 'invalid' })
      .set('Authorization', tokenSender);
    expect(res.status).toBe(400);
  });

  it('GET /api/v1/projects/{id}/messages should return 400 for invalid page in query', async () => {
    const res = await request
      .get('/api/v1/projects/mock-id/messages')
      .query({ page: 'invalid' })
      .set('Authorization', tokenSender);
    expect(res.status).toBe(400);
  });

  it('GET /api/v1/projects/{id} should get project and match swagger', async () => {
    const res = await request.get('/api/v1/projects/mock-id').set('Authorization', tokenSender);
    expect(res.status).toBe(200);
    validateSchema(res, '/api/v1/projects/{id}', 'get');
  });

  it('POST /api/v1/projects should create project and match swagger', async () => {
    const res = await request
      .post('/api/v1/projects')
      .set('Authorization', tokenSender)
      .send({
        name: 'New Borehole Project',
        assetType: 'borehole',
        location: {
          label: 'Lagos',
          lat: 6.5244,
          lng: 3.3792
        },
        currency: 'NGN',
        totalBudget: 5000000,
        scope: 'Drill a new borehole for the community.',
        milestones: [
          {
            stage: 'mobilization',
            order: 1,
            escrowAmount: 5000000,
            dueDate: '2027-01-01'
          }
        ]
      })
      .set('Idempotency-Key', 'test-key-123');
    
    expect(res.status).toBe(201);
    validateSchema(res, '/api/v1/projects', 'post');
  });

  it('POST /api/v1/projects should return cached response if Idempotency-Key is reused', async () => {
    const payload = {
      name: 'Idempotent Project',
      assetType: 'house',
      location: { label: 'Abuja', lat: 9.0765, lng: 7.3986 },
      currency: 'NGN',
      totalBudget: 1000000,
      scope: 'This is a detailed scope for the project so agents can review.',
      milestones: [{ order: 1, escrowAmount: 1000000, dueDate: '2027-01-01', stage: 'init' }]
    };

    const res1 = await request
      .post('/api/v1/projects')
      .set('Authorization', tokenSender)
      .set('Idempotency-Key', 'test-idem-key')
      .send(payload);
    
    if (res1.status === 400) console.error(res1.body);
    expect(res1.status).toBe(201);

    const res2 = await request
      .post('/api/v1/projects')
      .set('Authorization', tokenSender)
      .set('Idempotency-Key', 'test-idem-key')
      .send(payload);
    
    expect(res2.status).toBe(200);
    expect(res2.body).toEqual(res1.body);
  });

  it('PATCH /api/v1/projects/{id} should update project and match swagger', async () => {
    const res = await request
      .patch('/api/v1/projects/mock-id')
      .set('Authorization', tokenSender)
      .send({
        name: 'Updated Project Name',
        scope: 'Updated detailed scope',
        currentStage: 'Updated Stage'
      });
    expect(res.status).toBe(200);
    validateSchema(res, '/api/v1/projects/{id}', 'patch');
  });

  it('POST /api/v1/projects/{id}/unassign-agent should unassign agent and match swagger', async () => {
    const res = await request
      .post('/api/v1/projects/mock-id/unassign-agent')
      .set('Authorization', tokenSender)
      .send({ reason: 'Not responsive', requestDispute: true });
    expect([200, 409]).toContain(res.status);
    validateSchema(res, '/api/v1/projects/{id}/unassign-agent', 'post');
  });

  it('POST /api/v1/projects/{id}/assign-agent should assign agent and match swagger', async () => {
    const res = await request
      .post('/api/v1/projects/mock-unassigned-project/assign-agent')
      .set('Authorization', tokenSender)
      .send({ newAgentId: 'mock-id' });
    expect(res.status).toBe(200);
    validateSchema(res, '/api/v1/projects/{id}/assign-agent', 'post');
  });

  it('POST /api/v1/projects/{id}/send-funds should send funds and match swagger', async () => {
    const res = await request
      .post('/api/v1/projects/mock-id/send-funds')
      .set('Authorization', tokenSender)
      .send({ amount: 1000, currency: 'NGN', note: 'For mobilization' });
    expect(res.status).toBe(200);
    validateSchema(res, '/api/v1/projects/{id}/send-funds', 'post');
  });

  it('POST /api/v1/projects/{id}/send-funds should return cached response if Idempotency-Key is reused', async () => {
    const payload = { amount: 1000, currency: 'NGN', note: 'For mobilization' };

    const res1 = await request
      .post('/api/v1/projects/mock-id/send-funds')
      .set('Authorization', tokenSender)
      .set('Idempotency-Key', 'send-funds-idem-key')
      .send(payload);
    
    expect(res1.status).toBe(200);

    const res2 = await request
      .post('/api/v1/projects/mock-id/send-funds')
      .set('Authorization', tokenSender)
      .set('Idempotency-Key', 'send-funds-idem-key')
      .send(payload);
    
    expect(res2.status).toBe(200);
    expect(res2.body).toEqual(res1.body);
  });

  it('GET /api/v1/projects/{id}/bids should fetch bids and match swagger', async () => {
    const res = await request
      .get('/api/v1/projects/mock-id/bids')
      .set('Authorization', tokenSender);
    expect(res.status).toBe(200);
    validateSchema(res, '/api/v1/projects/{id}/bids', 'get');
  });

  it('POST /api/v1/projects/{id}/bids should submit bid and match swagger', async () => {
    const res = await request
      .post('/api/v1/projects/mock-id/bids')
      .set('Authorization', tokenAgent)
      .send({ bidAmount: 500000, proposal: 'I will do this.', proposedDurationWeeks: 4 });
    expect(res.status).toBe(201);
    validateSchema(res, '/api/v1/projects/{id}/bids', 'post');
  });

  it('POST /api/v1/projects/{id}/bids/{bidId}/accept should accept bid and match swagger', async () => {
    const res = await request
      .post('/api/v1/projects/mock-id/bids/bid-123/accept')
      .set('Authorization', tokenSender);
    expect(res.status).toBe(200);
    validateSchema(res, '/api/v1/projects/{id}/bids/{bidId}/accept', 'post');
  });

  it('POST /api/v1/projects/{id}/co-funders should invite co-funder and match swagger', async () => {
    const res = await request
      .post('/api/v1/projects/mock-id/co-funders')
      .set('Authorization', tokenSender)
      .send({ email: 'friend@test.com' });
    expect([200, 201]).toContain(res.status);
    validateSchema(res, '/api/v1/projects/{id}/co-funders', 'post');
  });

  it('GET /api/v1/projects/{id}/milestones should fetch milestones and match swagger', async () => {
    const res = await request
      .get('/api/v1/projects/mock-id/milestones')
      .set('Authorization', tokenSender);
    expect(res.status).toBe(200);
    validateSchema(res, '/api/v1/projects/{id}/milestones', 'get');
  });

  it('GET /api/v1/projects/{id}/proofs should fetch proofs and match swagger', async () => {
    const res = await request
      .get('/api/v1/projects/mock-id/proofs')
      .query({ page: 1, perPage: 10, milestoneId: 'mock-ms', status: 'approved' })
      .set('Authorization', tokenSender);
    expect(res.status).toBe(200);
    validateSchema(res, '/api/v1/projects/{id}/proofs', 'get');
  });

  it('GET /api/v1/projects/{id}/activity should fetch activity and match swagger', async () => {
    const res = await request
      .get('/api/v1/projects/mock-id/activity')
      .query({ page: 1, perPage: 10 })
      .set('Authorization', tokenSender);
    expect(res.status).toBe(200);
    validateSchema(res, '/api/v1/projects/{id}/activity', 'get');
  });

  it('GET /api/v1/projects/{id}/documents should fetch documents and match swagger', async () => {
    const res = await request
      .get('/api/v1/projects/mock-id/documents')
      .query({ page: 1, perPage: 10 })
      .set('Authorization', tokenSender);
    expect(res.status).toBe(200);
    validateSchema(res, '/api/v1/projects/{id}/documents', 'get');
  });

  it('POST /api/v1/projects/{id}/documents should upload document and match swagger', async () => {
    const res = await request
      .post('/api/v1/projects/mock-id/documents')
      .set('Authorization', tokenSender)
      .field('name', 'Contract Document')
      .field('kind', 'contract')
      .attach('file', Buffer.from('test file content'), 'test.pdf');
    expect(res.status).toBe(201);
    validateSchema(res, '/api/v1/projects/{id}/documents', 'post');
  });

  it('GET /api/v1/projects/{id}/messages should fetch messages and match swagger', async () => {
    const res = await request
      .get('/api/v1/projects/mock-id/messages')
      .query({ page: 1, perPage: 10 })
      .set('Authorization', tokenSender);
    expect(res.status).toBe(200);
    validateSchema(res, '/api/v1/projects/{id}/messages', 'get');
  });

  it('POST /api/v1/projects/{id}/messages should create message and match swagger', async () => {
    const res = await request
      .post('/api/v1/projects/mock-id/messages')
      .set('Authorization', tokenSender)
      .send({ body: 'Hello there' });
    expect(res.status).toBe(201);
    validateSchema(res, '/api/v1/projects/{id}/messages', 'post');
  });

  describe('Negative Tests', () => {
    it('POST /api/v1/projects should return 401 if unauthorized', async () => {
      const res = await request.post('/api/v1/projects').send({});
      expect(res.status).toBe(401);
    });

    it('POST /api/v1/projects should return 403 if not SENDER', async () => {
      const res = await request
        .post('/api/v1/projects')
        .set('Authorization', tokenAgent)
        .send({ name: 'Test' });
      expect(res.status).toBe(403);
    });

    it('POST /api/v1/projects should return 400 if missing fields', async () => {
      const res = await request
        .post('/api/v1/projects')
        .set('Authorization', tokenSender)
        .send({ name: 'Test' });
      expect(res.status).toBe(400);
    });
    
    it('PATCH /api/v1/projects/{id} should return 403 if not SENDER', async () => {
      const res = await request
        .patch('/api/v1/projects/mock-id')
        .set('Authorization', tokenAgent)
        .send({ name: 'Test' });
      expect(res.status).toBe(403);
    });

    it('POST /api/v1/projects/{id}/unassign-agent should return 403 if not SENDER', async () => {
      const res = await request
        .post('/api/v1/projects/mock-id/unassign-agent')
        .set('Authorization', tokenAgent)
        .send({ reason: 'Not responsive' });
      expect(res.status).toBe(403);
    });

    it('POST /api/v1/projects/{id}/unassign-agent should return 400 if missing reason', async () => {
      const res = await request
        .post('/api/v1/projects/mock-id/unassign-agent')
        .set('Authorization', tokenSender)
        .send({});
      expect(res.status).toBe(400);
    });

    it('POST /api/v1/projects/{id}/unassign-agent should return 400 if reason is empty', async () => {
      const res = await request
        .post('/api/v1/projects/mock-id/unassign-agent')
        .set('Authorization', tokenSender)
        .send({ reason: '' });
      expect(res.status).toBe(400);
    });

    it('POST /api/v1/projects/{id}/assign-agent should return 403 if not SENDER', async () => {
      const res = await request
        .post('/api/v1/projects/mock-id/assign-agent')
        .set('Authorization', tokenAgent)
        .send({ newAgentId: 'user-2' });
      expect(res.status).toBe(403);
    });

    it('POST /api/v1/projects/{id}/assign-agent should return 400 if missing newAgentId', async () => {
      const res = await request
        .post('/api/v1/projects/mock-id/assign-agent')
        .set('Authorization', tokenSender)
        .send({});
      expect(res.status).toBe(400);
    });

    it('POST /api/v1/projects/{id}/assign-agent should return 400 if newAgentId is empty', async () => {
      const res = await request
        .post('/api/v1/projects/mock-id/assign-agent')
        .set('Authorization', tokenSender)
        .send({ newAgentId: '' });
      expect(res.status).toBe(400);
    });

    it('POST /api/v1/projects/{id}/bids should return 403 if not AGENT', async () => {
      const res = await request
        .post('/api/v1/projects/mock-id/bids')
        .set('Authorization', tokenSender)
        .send({ bidAmount: 500000, proposal: 'I will do this.' });
      expect(res.status).toBe(403);
    });

    it('POST /api/v1/projects/{id}/bids should return 400 if missing fields', async () => {
      const res = await request
        .post('/api/v1/projects/mock-id/bids')
        .set('Authorization', tokenAgent)
        .send({});
      expect(res.status).toBe(400);
    });

    it('POST /api/v1/projects/{id}/bids/{bidId}/accept should return 403 if not SENDER', async () => {
      const res = await request
        .post('/api/v1/projects/mock-id/bids/bid-123/accept')
        .set('Authorization', tokenAgent);
      expect(res.status).toBe(403);
    });

    it('POST /api/v1/projects/{id}/send-funds should return 403 if not SENDER', async () => {
      const res = await request
        .post('/api/v1/projects/mock-id/send-funds')
        .set('Authorization', tokenAgent)
        .send({ amount: 1000, currency: 'NGN' });
      expect(res.status).toBe(403);
    });
    
    it('POST /api/v1/projects/{id}/send-funds should return 400 if missing fields', async () => {
      const res = await request
        .post('/api/v1/projects/mock-id/send-funds')
        .set('Authorization', tokenSender)
        .send({});
      expect(res.status).toBe(400);
    });

    it('POST /api/v1/projects/{id}/send-funds should return 400 if amount is less than 1', async () => {
      const res = await request
        .post('/api/v1/projects/mock-id/send-funds')
        .set('Authorization', tokenSender)
        .send({ amount: 0, currency: 'NGN' });
      expect(res.status).toBe(400);
    });

    it('POST /api/v1/projects/{id}/co-funders should return 403 if not SENDER', async () => {
      const res = await request
        .post('/api/v1/projects/mock-id/co-funders')
        .set('Authorization', tokenAgent)
        .send({ email: 'test@example.com' });
      expect(res.status).toBe(403);
    });

    it('POST /api/v1/projects/{id}/documents should return 400 if name is empty', async () => {
      const res = await request
        .post('/api/v1/projects/mock-id/documents')
        .set('Authorization', tokenSender)
        .field('name', '')
        .field('kind', 'contract')
        .attach('file', Buffer.from('test'), 'test.pdf');
      expect(res.status).toBe(400);
    });

    it('POST /api/v1/projects/{id}/documents should return 400 if kind is invalid', async () => {
      const res = await request
        .post('/api/v1/projects/mock-id/documents')
        .set('Authorization', tokenSender)
        .field('name', 'Valid name')
        .field('kind', 'invalid_kind')
        .attach('file', Buffer.from('test'), 'test.pdf');
      expect(res.status).toBe(400);
    });

    it('POST /api/v1/projects/{id}/co-funders should return 400 if missing email', async () => {
      const res = await request
        .post('/api/v1/projects/mock-id/co-funders')
        .set('Authorization', tokenSender)
        .send({});
      expect(res.status).toBe(400);
    });

    it('POST /api/v1/projects/{id}/co-funders should return 400 if email is invalid format', async () => {
      const res = await request
        .post('/api/v1/projects/mock-id/co-funders')
        .set('Authorization', tokenSender)
        .send({ email: 'not-an-email' });
      expect(res.status).toBe(400);
    });

    it('POST /api/v1/projects/{id}/messages should return 400 if missing body', async () => {
      const res = await request
        .post('/api/v1/projects/mock-id/messages')
        .set('Authorization', tokenSender)
        .send({});
      expect(res.status).toBe(400);
    });

    it('POST /api/v1/projects/{id}/messages should return 400 if body is empty', async () => {
      const res = await request
        .post('/api/v1/projects/mock-id/messages')
        .set('Authorization', tokenSender)
        .send({ body: '' });
      expect(res.status).toBe(400);
    });

    it('POST /api/v1/projects/{id}/messages should return 400 if body is too long', async () => {
      const res = await request
        .post('/api/v1/projects/mock-id/messages')
        .set('Authorization', tokenSender)
        .send({ body: 'a'.repeat(4001) });
      expect(res.status).toBe(400);
    });

    it('POST /api/v1/projects should return 400 if constraints violated', async () => {
      const res = await request
        .post('/api/v1/projects')
        .set('Authorization', tokenSender)
        .send({
          name: 'a', // minLength: 2
          assetType: 'invalid', // enum
          location: { label: '', lat: 0, lng: 0 }, // label minLength: 1
          currency: 'USD', // enum
          totalBudget: 0, // minimum: 1
          supervisionFeePercentage: 101, // maximum: 100
          scope: 'short', // minLength: 10
          fundingMode: 'invalid', // enum
          agentId: '', // minLength: 1
          milestones: [
            { stage: '', order: 0, escrowAmount: 0, dueDate: 'invalid-date' } // item constraints
          ]
        });
      expect(res.status).toBe(400);
    });

    it('PATCH /api/v1/projects/{id} should return 400 if name or scope too short', async () => {
      const res = await request
        .patch('/api/v1/projects/mock-id')
        .set('Authorization', tokenSender)
        .send({ name: 'a', scope: 'short' });
      expect(res.status).toBe(400);
    });

    it('POST /api/v1/projects/{id}/bids should return 400 if proposal too short or bidAmount too small', async () => {
      const res = await request
        .post('/api/v1/projects/mock-id/bids')
        .set('Authorization', tokenAgent)
        .send({ bidAmount: 0, proposal: 'no' });
      expect(res.status).toBe(400);
    });

    it('GET /api/v1/projects/{id} should return 404 if project not found', async () => {
      const res = await request
        .get('/api/v1/projects/bad-id')
        .set('Authorization', tokenSender);
      expect(res.status).toBe(404);
    });

    it('GET /api/v1/projects/{id} should return 403 if not owner', async () => {
      const res = await request
        .get('/api/v1/projects/mock-id-other-owner')
        .set('Authorization', tokenSender);
      expect(res.status).toBe(403);
    });

    it('PATCH /api/v1/projects/{id} should return 404 if project not found', async () => {
      const res = await request
        .patch('/api/v1/projects/bad-id')
        .set('Authorization', tokenSender)
        .send({ name: 'Valid name' });
      expect(res.status).toBe(404);
    });

    it('POST /api/v1/projects/{id}/unassign-agent should return 404 if project not found', async () => {
      const res = await request
        .post('/api/v1/projects/bad-id/unassign-agent')
        .set('Authorization', tokenSender)
        .send({ reason: 'Not responsive' });
      expect(res.status).toBe(404);
    });

    it('POST /api/v1/projects/{id}/assign-agent should return 404 if project not found', async () => {
      const res = await request
        .post('/api/v1/projects/bad-id/assign-agent')
        .set('Authorization', tokenSender)
        .send({ newAgentId: 'agent-1' });
      expect(res.status).toBe(404);
    });

    it('POST /api/v1/projects/{id}/bids/{bidId}/accept should return 404 if project not found', async () => {
      const res = await request
        .post('/api/v1/projects/bad-id/bids/bid-123/accept')
        .set('Authorization', tokenSender);
      expect(res.status).toBe(404);
    });

    it('POST /api/v1/projects should return 400 if milestones are missing', async () => {
      const res = await request
        .post('/api/v1/projects')
        .set('Authorization', tokenSender)
        .send({
          name: 'Project', assetType: 'generic', location: { label: 'A', lat: 1, lng: 1 },
          currency: 'NGN', totalBudget: 100, scope: 'A very detailed scope of work',
          milestones: []
        });
      expect(res.status).toBe(400);
    });

    it('POST /api/v1/projects should return 400 if escrow sum does not match totalBudget', async () => {
      const res = await request
        .post('/api/v1/projects')
        .set('Authorization', tokenSender)
        .send({
          name: 'Project', assetType: 'generic', location: { label: 'A', lat: 1, lng: 1 },
          currency: 'NGN', totalBudget: 100, scope: 'A very detailed scope of work',
          milestones: [{ order: 1, stage: 'A', escrowAmount: 50, dueDate: '2027-01-01' }]
        });
      expect(res.status).toBe(400);
    });
    it('GET /api/v1/projects/{id}/bids should return 200 (empty array) if project not found', async () => {
      const res = await request
        .get('/api/v1/projects/00000000-0000-0000-0000-000000000000/bids')
        .set('Authorization', tokenSender);
      expect(res.status).toBe(200);
    });

    it('POST /api/v1/projects/{id}/bids should return 404 if project not found', async () => {
      const res = await request
        .post('/api/v1/projects/00000000-0000-0000-0000-000000000000/bids')
        .set('Authorization', tokenAgent)
        .send({ bidAmount: 500000, proposal: 'I will do this.' });
      expect(res.status).toBe(404);
    });

    it('POST /api/v1/projects/{id}/co-funders should return 404 if project not found', async () => {
      const res = await request
        .post('/api/v1/projects/00000000-0000-0000-0000-000000000000/co-funders')
        .set('Authorization', tokenSender)
        .send({ email: 'test@example.com' });
      expect(res.status).toBe(404);
    });

    it('GET /api/v1/projects/{id}/milestones should return 404 if project not found', async () => {
      const res = await request
        .get('/api/v1/projects/00000000-0000-0000-0000-000000000000/milestones')
        .set('Authorization', tokenSender);
      expect(res.status).toBe(404);
    });

    it('GET /api/v1/projects/{id}/proofs should return 404 if project not found', async () => {
      const res = await request
        .get('/api/v1/projects/00000000-0000-0000-0000-000000000000/proofs')
        .set('Authorization', tokenSender);
      expect(res.status).toBe(404);
    });

    it('GET /api/v1/projects/{id}/proofs should return 403 if not owner', async () => {
      const res = await request
        .get('/api/v1/projects/mock-id-other-owner/proofs')
        .set('Authorization', tokenSender);
      expect(res.status).toBe(403);
    });

    it('GET /api/v1/projects/{id}/activity should return 404 if project not found', async () => {
      const res = await request
        .get('/api/v1/projects/00000000-0000-0000-0000-000000000000/activity')
        .set('Authorization', tokenSender);
      expect(res.status).toBe(404);
    });

    it('GET /api/v1/projects/{id}/documents should return 404 if project not found', async () => {
      const res = await request
        .get('/api/v1/projects/bad-id/documents')
        .set('Authorization', tokenSender);
      expect(res.status).toBe(404);
    });

    it('POST /api/v1/projects/{id}/documents should return 404 if project not found', async () => {
      const res = await request
        .post('/api/v1/projects/bad-id/documents')
        .set('Authorization', tokenSender)
        .field('name', 'Contract Document')
        .field('kind', 'contract')
        .attach('file', Buffer.from('test file content'), 'test.pdf');
      expect(res.status).toBe(404);
    });

    it('GET /api/v1/projects/{id}/messages should return 404 if project not found', async () => {
      const res = await request
        .get('/api/v1/projects/bad-id/messages')
        .set('Authorization', tokenSender);
      expect(res.status).toBe(404);
    });

    it('POST /api/v1/projects/{id}/messages should return 404 if project not found', async () => {
      const res = await request
        .post('/api/v1/projects/bad-id/messages')
        .set('Authorization', tokenSender)
        .send({ body: 'Hello there' });
      expect(res.status).toBe(404);
    });
  });
});
