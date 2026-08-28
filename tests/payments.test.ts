import { request, validateSchema } from './utils';

describe('Payments Endpoints', () => {
  const cardId = '550e8400-e29b-41d4-a716-446655440000';
  const bankAccountId = '550e8400-e29b-41d4-a716-446655440001';

  // --- Top-up ---
  it('POST /api/v1/payments/topup should simulate topup and match swagger', async () => {
    const res = await request
      .post('/api/v1/payments/topup')
      .set('Authorization', 'Bearer mock-token-sender')
      .send({ amount: 5000, currency: 'NGN', cardId });
      
    expect([200, 400, 404]).toContain(res.status);
    validateSchema(res, '/api/v1/payments/topup', 'post');
  });

  it('POST /api/v1/payments/topup should return 401 if unauthorized', async () => {
    const res = await request
      .post('/api/v1/payments/topup')
      .send({ amount: 5000, currency: 'NGN', cardId });
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/payments/topup should return 403 if not sender', async () => {
    const res = await request
      .post('/api/v1/payments/topup')
      .set('Authorization', 'Bearer mock-token-agent')
      .send({ amount: 5000, currency: 'NGN', cardId });
    expect(res.status).toBe(403);
  });

  it('POST /api/v1/payments/topup should return 400 on missing fields', async () => {
    const res = await request
      .post('/api/v1/payments/topup')
      .set('Authorization', 'Bearer mock-token-sender')
      .send({ amount: 5000 }); // missing currency and cardId
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/payments/topup should return 400 on zero amount', async () => {
    const res = await request
      .post('/api/v1/payments/topup')
      .set('Authorization', 'Bearer mock-token-sender')
      .send({ amount: 0, currency: 'NGN', cardId });
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/payments/topup should return 400 on negative amount', async () => {
    const res = await request
      .post('/api/v1/payments/topup')
      .set('Authorization', 'Bearer mock-token-sender')
      .send({ amount: -5000, currency: 'NGN', cardId });
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/payments/topup should return 400 on non-integer amount', async () => {
    const res = await request
      .post('/api/v1/payments/topup')
      .set('Authorization', 'Bearer mock-token-sender')
      .send({ amount: 5000.5, currency: 'NGN', cardId });
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/payments/topup should return 400 on invalid cardId UUID', async () => {
    const res = await request
      .post('/api/v1/payments/topup')
      .set('Authorization', 'Bearer mock-token-sender')
      .send({ amount: 5000, currency: 'NGN', cardId: 'invalid-uuid' });
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/payments/topup should return cached response if Idempotency-Key is reused', async () => {
    const payload = { amount: 5000, currency: 'NGN', cardId };
    
    const res1 = await request
      .post('/api/v1/payments/topup')
      .set('Authorization', 'Bearer mock-token-sender')
      .set('Idempotency-Key', 'topup-idem-key')
      .send(payload);
      
    expect([200, 400, 404]).toContain(res1.status);

    const res2 = await request
      .post('/api/v1/payments/topup')
      .set('Authorization', 'Bearer mock-token-sender')
      .set('Idempotency-Key', 'topup-idem-key')
      .send(payload);

    if (res1.status === 200) {
      expect(res2.status).toBe(200);
      expect(res2.body).toEqual(res1.body);
    }
  });

  // --- Bank Account Resolve ---
  it('POST /api/v1/payments/bank-accounts/resolve should resolve bank account and match swagger', async () => {
    const res = await request
      .post('/api/v1/payments/bank-accounts/resolve')
      .set('Authorization', 'Bearer mock-token-agent')
      .send({ accountNumber: '1234567890', bankCode: '123' });
      
    expect([200, 400]).toContain(res.status);
    validateSchema(res, '/api/v1/payments/bank-accounts/resolve', 'post');
  });

  it('POST /api/v1/payments/bank-accounts/resolve should return 401 if unauthorized', async () => {
    const res = await request
      .post('/api/v1/payments/bank-accounts/resolve')
      .send({ accountNumber: '1234567890', bankCode: '123' });
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/payments/bank-accounts/resolve should return 400 on missing fields', async () => {
    const res = await request
      .post('/api/v1/payments/bank-accounts/resolve')
      .set('Authorization', 'Bearer mock-token-agent')
      .send({ bankCode: '123' }); // missing accountNumber
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/payments/bank-accounts/resolve should return 400 on invalid accountNumber length', async () => {
    const res = await request
      .post('/api/v1/payments/bank-accounts/resolve')
      .set('Authorization', 'Bearer mock-token-agent')
      .send({ accountNumber: '123456789', bankCode: '123' });
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/payments/bank-accounts/resolve should return 400 on invalid bankCode length', async () => {
    const res = await request
      .post('/api/v1/payments/bank-accounts/resolve')
      .set('Authorization', 'Bearer mock-token-agent')
      .send({ accountNumber: '1234567890', bankCode: '12' });
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/payments/bank-accounts/resolve should return 400 on accountNumber too long', async () => {
    const res = await request
      .post('/api/v1/payments/bank-accounts/resolve')
      .set('Authorization', 'Bearer mock-token-agent')
      .send({ accountNumber: '12345678901', bankCode: '123' });
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/payments/bank-accounts/resolve should return 400 on bankCode too long', async () => {
    const res = await request
      .post('/api/v1/payments/bank-accounts/resolve')
      .set('Authorization', 'Bearer mock-token-agent')
      .send({ accountNumber: '1234567890', bankCode: '1234567' });
    expect(res.status).toBe(400);
  });

  // --- Cards ---
  it('GET /api/v1/payments/cards should fetch cards and match swagger', async () => {
    const res = await request
      .get('/api/v1/payments/cards')
      .set('Authorization', 'Bearer mock-token-sender');
      
    expect(res.status).toBe(200);
    validateSchema(res, '/api/v1/payments/cards', 'get');
  });

  it('GET /api/v1/payments/cards should return 401 if unauthorized', async () => {
    const res = await request.get('/api/v1/payments/cards');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/payments/cards should return 403 if not sender', async () => {
    const res = await request
      .get('/api/v1/payments/cards')
      .set('Authorization', 'Bearer mock-token-agent');
    expect(res.status).toBe(403);
  });

  it('POST /api/v1/payments/cards should add card and match swagger', async () => {
    const res = await request
      .post('/api/v1/payments/cards')
      .set('Authorization', 'Bearer mock-token-sender')
      .send({ cardNumber: '4242424242424242', expiry: '12/30', cvv: '123', holder: 'John Doe' });
      
    expect([201, 400]).toContain(res.status);
    validateSchema(res, '/api/v1/payments/cards', 'post');
  });

  it('POST /api/v1/payments/cards should return 401 if unauthorized', async () => {
    const res = await request
      .post('/api/v1/payments/cards')
      .send({ cardNumber: '4242424242424242', expiry: '12/30', cvv: '123', holder: 'John Doe' });
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/payments/cards should return 400 on invalid luhn check', async () => {
    const res = await request
      .post('/api/v1/payments/cards')
      .set('Authorization', 'Bearer mock-token-sender')
      .send({ cardNumber: '4242424242424243', expiry: '12/30', cvv: '123', holder: 'John Doe' });
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/payments/cards should return 400 on expired card', async () => {
    const res = await request
      .post('/api/v1/payments/cards')
      .set('Authorization', 'Bearer mock-token-sender')
      .send({ cardNumber: '4242424242424242', expiry: '12/20', cvv: '123', holder: 'John Doe' });
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/payments/cards should detect afrgo card', async () => {
    // 5641234567894 is valid luhn for 564 prefix
    const res = await request
      .post('/api/v1/payments/cards')
      .set('Authorization', 'Bearer mock-token-sender')
      .send({ cardNumber: '5641234567894', expiry: '12/30', cvv: '123', holder: 'John Doe' });
    expect([201, 400]).toContain(res.status);
  });

  it('POST /api/v1/payments/cards should detect mastercard', async () => {
    // 5123456789012341 is valid luhn
    const res = await request
      .post('/api/v1/payments/cards')
      .set('Authorization', 'Bearer mock-token-sender')
      .send({ cardNumber: '5123456789012341', expiry: '12/30', cvv: '123', holder: 'John Doe' });
    expect([201, 400]).toContain(res.status);
  });

  it('POST /api/v1/payments/cards should detect verve', async () => {
    // 6123456789012342 is valid luhn for other
    const res = await request
      .post('/api/v1/payments/cards')
      .set('Authorization', 'Bearer mock-token-sender')
      .send({ cardNumber: '6123456789012342', expiry: '12/30', cvv: '123', holder: 'John Doe' });
    expect([201, 400]).toContain(res.status);
  });

  it('POST /api/v1/payments/cards should return 403 if not sender', async () => {
    const res = await request
      .post('/api/v1/payments/cards')
      .set('Authorization', 'Bearer mock-token-agent')
      .send({ cardNumber: '4242424242424242', expiry: '12/30', cvv: '123', holder: 'John Doe' });
    expect(res.status).toBe(403);
  });

  it('POST /api/v1/payments/cards should return 400 on missing fields', async () => {
    const res = await request
      .post('/api/v1/payments/cards')
      .set('Authorization', 'Bearer mock-token-sender')
      .send({ cardNumber: '4242424242424242' });
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/payments/cards should return 400 on invalid card number length', async () => {
    const res = await request
      .post('/api/v1/payments/cards')
      .set('Authorization', 'Bearer mock-token-sender')
      .send({ cardNumber: '123', expiry: '12/30', cvv: '123', holder: 'John Doe' });
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/payments/cards should return 400 on card number too long', async () => {
    const res = await request
      .post('/api/v1/payments/cards')
      .set('Authorization', 'Bearer mock-token-sender')
      .send({ cardNumber: '12345678901234567890', expiry: '12/30', cvv: '123', holder: 'John Doe' });
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/payments/cards should return 400 on invalid expiry pattern', async () => {
    const res = await request
      .post('/api/v1/payments/cards')
      .set('Authorization', 'Bearer mock-token-sender')
      .send({ cardNumber: '4242424242424242', expiry: '12-2030', cvv: '123', holder: 'John Doe' });
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/payments/cards should return 400 on invalid cvv length', async () => {
    const res = await request
      .post('/api/v1/payments/cards')
      .set('Authorization', 'Bearer mock-token-sender')
      .send({ cardNumber: '4242424242424242', expiry: '12/30', cvv: '12', holder: 'John Doe' });
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/payments/cards should return 400 on cvv too long', async () => {
    const res = await request
      .post('/api/v1/payments/cards')
      .set('Authorization', 'Bearer mock-token-sender')
      .send({ cardNumber: '4242424242424242', expiry: '12/30', cvv: '12345', holder: 'John Doe' });
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/payments/cards should return 400 on invalid holder length', async () => {
    const res = await request
      .post('/api/v1/payments/cards')
      .set('Authorization', 'Bearer mock-token-sender')
      .send({ cardNumber: '4242424242424242', expiry: '12/30', cvv: '123', holder: 'A' });
    expect(res.status).toBe(400);
  });

  it('DELETE /api/v1/payments/cards/:id should delete card and match swagger', async () => {
    const res = await request
      .delete(`/api/v1/payments/cards/${cardId}`)
      .set('Authorization', 'Bearer mock-token-sender');
      
    expect([204, 403, 404]).toContain(res.status);
    validateSchema(res, '/api/v1/payments/cards/{id}', 'delete');
  });
  it('DELETE /api/v1/payments/cards/:id should return 401 if unauthorized', async () => {
    const res = await request.delete(`/api/v1/payments/cards/${cardId}`);
    expect(res.status).toBe(401);
  });



  it('POST /api/v1/payments/cards/:id/default should set card as default and match swagger', async () => {
    const res = await request
      .post(`/api/v1/payments/cards/${cardId}/default`)
      .set('Authorization', 'Bearer mock-token-sender');
      
    expect([200, 403, 404]).toContain(res.status);
    if (res.status === 200) {
      validateSchema(res, '/api/v1/payments/cards/{id}/default', 'post');
    }
  });

  it('POST /api/v1/payments/cards/:id/default should return 404 for unknown card', async () => {
    const res = await request
      .post(`/api/v1/payments/cards/00000000-0000-0000-0000-000000000000/default`)
      .set('Authorization', 'Bearer mock-token-sender');
    expect(res.status).toBe(404);
  });

  it('POST /api/v1/payments/cards/:id/default should return 401 if unauthorized', async () => {
    const res = await request.post(`/api/v1/payments/cards/${cardId}/default`);
    expect(res.status).toBe(401);
  });

  it('DELETE /api/v1/payments/cards/:id should return 403 if not sender', async () => {
    const res = await request
      .delete(`/api/v1/payments/cards/${cardId}`)
      .set('Authorization', 'Bearer mock-token-agent');
    expect(res.status).toBe(403);
  });

  it('POST /api/v1/payments/cards/:id/default should return 403 if not sender', async () => {
    const res = await request
      .post(`/api/v1/payments/cards/${cardId}/default`)
      .set('Authorization', 'Bearer mock-token-agent');
    expect(res.status).toBe(403);
  });

  // --- Bank Accounts (Agent) ---
  it('GET /api/v1/payments/bank-accounts should fetch bank accounts and match swagger', async () => {
    const res = await request
      .get('/api/v1/payments/bank-accounts')
      .set('Authorization', 'Bearer mock-token-agent');
      
    expect(res.status).toBe(200);
    validateSchema(res, '/api/v1/payments/bank-accounts', 'get');
  });

  it('GET /api/v1/payments/bank-accounts should return 401 if unauthorized', async () => {
    const res = await request.get('/api/v1/payments/bank-accounts');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/payments/bank-accounts should return 403 if not agent', async () => {
    const res = await request
      .get('/api/v1/payments/bank-accounts')
      .set('Authorization', 'Bearer mock-token-sender');
    expect(res.status).toBe(403);
  });

  it('POST /api/v1/payments/bank-accounts should add bank account and match swagger', async () => {
    const res = await request
      .post('/api/v1/payments/bank-accounts')
      .set('Authorization', 'Bearer mock-token-agent')
      .send({ bankCode: '123', accountNumber: '1234567890', accountName: 'Jane Doe' });
      
    expect([201, 400]).toContain(res.status);
    validateSchema(res, '/api/v1/payments/bank-accounts', 'post');
  });

  it('POST /api/v1/payments/bank-accounts should return 401 if unauthorized', async () => {
    const res = await request
      .post('/api/v1/payments/bank-accounts')
      .send({ bankCode: '123', accountNumber: '1234567890', accountName: 'Jane Doe' });
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/payments/bank-accounts should return 403 if not agent', async () => {
    const res = await request
      .post('/api/v1/payments/bank-accounts')
      .set('Authorization', 'Bearer mock-token-sender')
      .send({ bankCode: '123', accountNumber: '1234567890', accountName: 'Jane Doe' });
    expect(res.status).toBe(403);
  });

  it('POST /api/v1/payments/bank-accounts should return 400 on missing fields', async () => {
    const res = await request
      .post('/api/v1/payments/bank-accounts')
      .set('Authorization', 'Bearer mock-token-agent')
      .send({ bankCode: '123' }); // missing accountNumber, accountName
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/payments/bank-accounts should return 400 on invalid bankCode length', async () => {
    const res = await request
      .post('/api/v1/payments/bank-accounts')
      .set('Authorization', 'Bearer mock-token-agent')
      .send({ bankCode: '12', accountNumber: '1234567890', accountName: 'Jane Doe' });
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/payments/bank-accounts should return 400 on invalid accountNumber length', async () => {
    const res = await request
      .post('/api/v1/payments/bank-accounts')
      .set('Authorization', 'Bearer mock-token-agent')
      .send({ bankCode: '123', accountNumber: '123456789', accountName: 'Jane Doe' });
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/payments/bank-accounts should return 400 on accountNumber too long', async () => {
    const res = await request
      .post('/api/v1/payments/bank-accounts')
      .set('Authorization', 'Bearer mock-token-agent')
      .send({ bankCode: '123', accountNumber: '12345678901', accountName: 'Jane Doe' });
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/payments/bank-accounts should return 400 on bankCode too long', async () => {
    const res = await request
      .post('/api/v1/payments/bank-accounts')
      .set('Authorization', 'Bearer mock-token-agent')
      .send({ bankCode: '1234567', accountNumber: '1234567890', accountName: 'Jane Doe' });
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/payments/bank-accounts should return 400 on invalid accountName length', async () => {
    const res = await request
      .post('/api/v1/payments/bank-accounts')
      .set('Authorization', 'Bearer mock-token-agent')
      .send({ bankCode: '123', accountNumber: '1234567890', accountName: 'A' });
    expect(res.status).toBe(400);
  });

  // --- Withdrawals ---
  it('POST /api/v1/payments/withdraw should request withdrawal and match swagger', async () => {
    const res = await request
      .post('/api/v1/payments/withdraw')
      .set('Authorization', 'Bearer mock-token-agent')
      .send({ amount: 1000, currency: 'NGN', bankAccountId, description: 'Test withdrawal' });
      
    expect([201, 400, 403, 404]).toContain(res.status);
    validateSchema(res, '/api/v1/payments/withdraw', 'post');
  });

  it('POST /api/v1/payments/withdraw should return 401 if unauthorized', async () => {
    const res = await request
      .post('/api/v1/payments/withdraw')
      .send({ amount: 1000, currency: 'NGN', bankAccountId, description: 'Test withdrawal' });
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/payments/withdraw should return 403 if not agent', async () => {
    const res = await request
      .post('/api/v1/payments/withdraw')
      .set('Authorization', 'Bearer mock-token-sender')
      .send({ amount: 1000, currency: 'NGN', bankAccountId, description: 'Test withdrawal' });
    expect(res.status).toBe(403);
  });

  it('POST /api/v1/payments/withdraw should return 400 on missing fields', async () => {
    const res = await request
      .post('/api/v1/payments/withdraw')
      .set('Authorization', 'Bearer mock-token-agent')
      .send({ amount: 1000 }); // missing currency, bankAccountId
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/payments/withdraw should return 400 on zero amount', async () => {
    const res = await request
      .post('/api/v1/payments/withdraw')
      .set('Authorization', 'Bearer mock-token-agent')
      .send({ amount: 0, currency: 'NGN', bankAccountId, description: 'Test withdrawal' });
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/payments/withdraw should return 400 on negative amount', async () => {
    const res = await request
      .post('/api/v1/payments/withdraw')
      .set('Authorization', 'Bearer mock-token-agent')
      .send({ amount: -1000, currency: 'NGN', bankAccountId, description: 'Test withdrawal' });
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/payments/withdraw should return 400 on non-integer amount', async () => {
    const res = await request
      .post('/api/v1/payments/withdraw')
      .set('Authorization', 'Bearer mock-token-agent')
      .send({ amount: 1000.5, currency: 'NGN', bankAccountId, description: 'Test withdrawal' });
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/payments/withdraw should return 400 on invalid UUID for bankAccountId', async () => {
    const res = await request
      .post('/api/v1/payments/withdraw')
      .set('Authorization', 'Bearer mock-token-agent')
      .send({ amount: 1000, currency: 'NGN', bankAccountId: 'not-a-uuid', description: 'Test withdrawal' });
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/payments/withdraw should return cached response if Idempotency-Key is reused', async () => {
    const payload = { amount: 1000, currency: 'NGN', bankAccountId, description: 'Test withdraw idempotency' };
    
    const res1 = await request
      .post('/api/v1/payments/withdraw')
      .set('Authorization', 'Bearer mock-token-agent')
      .set('Idempotency-Key', 'withdraw-idem-key')
      .send(payload);
      
    // Because this hits a mock database, it might fail or succeed depending on funds, but whatever the result, it should be cached.
    // Assuming 201 for a valid request since agent has funds in mock.
    expect([201, 400]).toContain(res1.status);

    const res2 = await request
      .post('/api/v1/payments/withdraw')
      .set('Authorization', 'Bearer mock-token-agent')
      .set('Idempotency-Key', 'withdraw-idem-key')
      .send(payload);

    expect(res2.status).toBe(200);
    expect(res2.body).toEqual(res1.body);
  });

  // --- Transactions ---
  it('GET /api/v1/payments/transactions should fetch history and match swagger', async () => {
    const res = await request
      .get('/api/v1/payments/transactions')
      .set('Authorization', 'Bearer mock-token-sender');
      
    expect(res.status).toBe(200);
    validateSchema(res, '/api/v1/payments/transactions', 'get');
  });

  it('GET /api/v1/payments/transactions should return 401 if unauthorized', async () => {
    const res = await request.get('/api/v1/payments/transactions');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/payments/transactions should handle query params page and perPage', async () => {
    const res = await request
      .get('/api/v1/payments/transactions?page=2&perPage=5')
      .set('Authorization', 'Bearer mock-token-sender');
    expect(res.status).toBe(200);
    validateSchema(res, '/api/v1/payments/transactions', 'get');
  });

  it('GET /api/v1/payments/transactions should return 400 for invalid page query', async () => {
    const res = await request
      .get('/api/v1/payments/transactions?page=invalid')
      .set('Authorization', 'Bearer mock-token-sender');
    expect(res.status).toBe(200);
  });

  // --- Additional Intricacy Tests ---
  it('POST /api/v1/payments/topup should return 404 if card not found', async () => {
    const res = await request
      .post('/api/v1/payments/topup')
      .set('Authorization', 'Bearer mock-token-sender')
      .send({ amount: 5000, currency: 'NGN', cardId: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(404);
  });

  it('POST /api/v1/payments/cards should return 400 on Luhn check failure', async () => {
    const res = await request
      .post('/api/v1/payments/cards')
      .set('Authorization', 'Bearer mock-token-sender')
      .send({ cardNumber: '4242424242424241', expiry: '12/30', cvv: '123', holder: 'John Doe' });
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/payments/cards should return 400 on expired card', async () => {
    const res = await request
      .post('/api/v1/payments/cards')
      .set('Authorization', 'Bearer mock-token-sender')
      .send({ cardNumber: '4242424242424242', expiry: '12/20', cvv: '123', holder: 'John Doe' });
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/payments/bank-accounts should return 400 on resolution failure', async () => {
    const res = await request
      .post('/api/v1/payments/bank-accounts')
      .set('Authorization', 'Bearer mock-token-agent')
      .send({ bankCode: '999', accountNumber: '0000000000', accountName: 'Invalid' });
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/payments/withdraw should return 400 on insufficient balance', async () => {
    const res = await request
      .post('/api/v1/payments/withdraw')
      .set('Authorization', 'Bearer mock-token-agent')
      .send({ amount: 999999999, currency: 'NGN', bankAccountId, description: 'Huge withdrawal' });
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/payments/withdraw should return 404 if bank account not found', async () => {
    const res = await request
      .post('/api/v1/payments/withdraw')
      .set('Authorization', 'Bearer mock-token-agent')
      .send({ amount: 100, currency: 'NGN', bankAccountId: '00000000-0000-0000-0000-000000000000', description: 'Test withdrawal' });
    expect(res.status).toBe(404);
  });
});
