import { jest } from '@jest/globals';
import { Role } from '../src/types/enums';

const getInitialDb = () => ({
  users: [
    { id: 'user-1', email: 'sender@test.com', role: Role.SENDER, country: 'NG', full_name: 'Test Sender', totp_secret: 'mock-secret', two_fa_pending: true, wallet_balance: 10000000 },
    { id: 'user-2', email: 'agent@test.com', role: Role.AGENT, country: 'NG', full_name: 'Test Agent' },
    { id: 'mock-id', email: 'mock@test.com', role: Role.AGENT, country: 'NG', full_name: 'Mock Agent' },
    { id: '550e8400-e29b-41d4-a716-446655440002', email: 'msg-agent@test.com', role: Role.AGENT, country: 'NG', full_name: 'Message Agent' }
  ],
  agents: [
    { id: 'mock-id', user_id: 'mock-id', name: 'Mock Agent', bio: 'I am a mock agent', location: 'Lagos', rating: 4.5, verified: true, specialties: ['plumbing', 'electrical'] },
    { id: '550e8400-e29b-41d4-a716-446655440002', user_id: '550e8400-e29b-41d4-a716-446655440002', name: 'Message Agent', bio: 'Msg Agent', location: 'Lagos', rating: 5, verified: true, specialties: [] }
  ],
  agent_reviews: [],
  agent_portfolios: [],
  agent_credentials: [],
  agent_verification_docs: [],
  documents: [
    { id: 'mock-doc-id', project_id: 'mock-id', uploaded_by: 'user-1', file_url: 'http://test.com', type: 'contract' }
  ],
  proofs: [
    { id: 'mock-id', project_id: 'mock-id', milestone_id: 'mock-id', uploaded_by: 'user-1', file_url: 'http://test.com' },
    { id: 'mock-proof-submitted', project_id: 'mock-id', milestone_id: 'mock-submitted-id', uploaded_by: 'mock-id', file_url: 'http://test.com' },
    { id: 'mock-proof-approved', project_id: 'mock-id', milestone_id: 'mock-approved-id', uploaded_by: 'mock-id', file_url: 'http://test.com' },
    { id: 'mock-id-other-owner', project_id: 'mock-id-other-owner', milestone_id: 'milestone-1', uploader_id: 'user-2', status: 'pending', file_url: 'http://test.com/img.jpg', caption: 'Test', created_at: new Date().toISOString() }
  ],
  project_messages: [],
  project_bids: [
    { id: 'bid-123', project_id: 'mock-id', agent_id: 'mock-id', bid_amount: 5000, status: 'pending' }
  ],
  message_threads: [
    { id: '550e8400-e29b-41d4-a716-446655440003', project_id: '550e8400-e29b-41d4-a716-446655440004', sender_id: 'user-1', agent_id: '550e8400-e29b-41d4-a716-446655440002' }
  ],
  messages: [],
  cards: [
    { id: '550e8400-e29b-41d4-a716-446655440000', user_id: 'user-1', last4: '0000', is_default: false, brand: 'Visa' },
    { id: 'card-for-default', user_id: 'user-1', last4: '1111', is_default: false, brand: 'MasterCard' }
  ],
  bank_accounts: [
    { id: '550e8400-e29b-41d4-a716-446655440001', user_id: 'mock-id', account_number: '1234567890', bank_code: '123', account_name: 'Jane Doe', recipient_code: 'RCP_test123' }
  ],
  transactions: [
    { id: 'tx-1', user_id: 'user-1', amount: 5000, type: 'credit', status: 'completed' },
    { id: 'tx-2', user_id: 'user-2', amount: 1000, type: 'credit', status: 'completed' }
  ],
  projects: [
    { id: 'project-1', sender_id: 'user-1', agent_id: 'user-2', title: 'Test Project', status: 'active', budget: 10000, total_budget: 10000, funds_released: 5000, funds_in_escrow: 5000, total_funded: 10000, unallocated_funds: 10000 },
    { id: 'mock-id', sender_id: 'user-1', agent_id: 'mock-id', title: 'Mock Project', status: 'active', budget: 10000, total_budget: 10000, funds_released: 0, funds_in_escrow: 10000, total_funded: 10000, unallocated_funds: 10000 },
    { id: 'mock-id-other-owner', sender_id: 'other-user', agent_id: 'mock-id', title: 'Other Project', status: 'active', budget: 1000, total_budget: 1000, funds_released: 0, funds_in_escrow: 1000, total_funded: 1000, unallocated_funds: 1000 },
    { id: 'mock-unassigned-project', sender_id: 'user-1', agent_id: null, title: 'Unassigned Project', status: 'agent_unassigned', budget: 10000, total_budget: 10000, funds_released: 0, funds_in_escrow: 0, total_funded: 10000, unallocated_funds: 10000 },
    { id: '550e8400-e29b-41d4-a716-446655440004', sender_id: 'user-1', agent_id: 'mock-id', title: 'Project Messages', status: 'active', budget: 10000, total_budget: 10000, funds_released: 0, funds_in_escrow: 0, total_funded: 10000, unallocated_funds: 10000 }
  ],
  milestones: [
    { id: 'milestone-1', project_id: 'project-1', title: 'Phase 1', amount: 1000, escrow_amount: 1000, status: 'funded' },
    { id: 'milestone-2', project_id: 'project-1', title: 'Phase 2', amount: 5000, escrow_amount: 5000, status: 'pending' },
    { id: 'milestone-3', project_id: 'project-1', title: 'Phase 3', amount: 2000, escrow_amount: 2000, status: 'released' },
    { id: 'mock-m-id', project_id: 'mock-id', title: 'Phase mock', amount: 5000, escrow_amount: 5000, status: 'released' },
    { id: 'mock-id', project_id: 'mock-id', title: 'Phase mock-id', amount: 1000, escrow_amount: 1000, status: 'funded' },
    { id: 'mock-submitted-id', project_id: 'mock-id', title: 'Phase mock-sub', amount: 1000, escrow_amount: 1000, status: 'proof_submitted' },
    { id: 'mock-approved-id', project_id: 'mock-id', title: 'Phase mock-app', amount: 1000, escrow_amount: 1000, status: 'approved' }
  ],

  idempotency_keys: [],
  auth_preferences: [
    { user_id: 'user-1', two_factor_enabled: false }
  ],
  auth_codes: [
    { id: '1', user_id: 'user-1', code: '123456', expires_at: new Date(Date.now() + 10000).toISOString() }
  ]
});

let db: any = getInitialDb();
(global as any).resetDb = () => {
  db = getInitialDb();
};
if (typeof beforeEach !== 'undefined') {
  beforeEach(() => {
    (global as any).resetDb();
  });
}

const createQueryBuilder = (table: string) => {
  const builder: any = {
    _action: 'select',
    _data: null,
    _filters: [] as any[],
    _select: null,
    select: jest.fn((...args) => { if (builder._action !== 'insert' && builder._action !== 'update' && builder._action !== 'delete') builder._action = 'select'; builder._select = args[0]; return builder; }),
    insert: jest.fn((data: any) => { builder._action = 'insert'; builder._data = data; return builder; }),
    update: jest.fn((data: any) => { builder._action = 'update'; builder._data = data; return builder; }),
    delete: jest.fn(() => { builder._action = 'delete'; return builder; }),
    eq: jest.fn((col: string, val: any) => { builder._filters.push({ col, val, op: 'eq' }); return builder; }),
    neq: jest.fn((col: string, val: any) => { builder._filters.push({ col, val, op: 'neq' }); return builder; }),
    in: jest.fn((col: string, vals: any[]) => { builder._filters.push({ col, vals, op: 'in' }); return builder; }),
    match: jest.fn((obj: any) => { 
      for(let k in obj) builder._filters.push({ col: k, val: obj[k], op: 'eq' });
      return builder; 
    }),
    order: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    range: jest.fn(() => builder),
    ilike: jest.fn(() => builder),
    gte: jest.fn(() => builder),
    lte: jest.fn(() => builder),
    gt: jest.fn(() => builder),
    lt: jest.fn(() => builder),
    overlaps: jest.fn(() => builder),
    or: jest.fn(() => builder),
    execute: () => {
      let items = db[table] ? [...db[table]] : [];
      let result: any = [];
      
      if (builder._action === 'insert') {
        const arr = Array.isArray(builder._data) ? builder._data : [builder._data];
        const inserted = arr.map((i: any) => ({ id: Math.random().toString(), ...i }));
        if (!db[table]) db[table] = [];
        db[table].push(...inserted);
        result = inserted;
      } else {
        items = items.filter(item => {
          for (const f of builder._filters) {
            if (f.op === 'in') {
              if (!f.vals.includes(item[f.col])) return false;
            } else if (f.op === 'eq') {
              if (item[f.col] !== f.val) return false;
            } else if (f.op === 'neq') {
              if (item[f.col] === f.val) return false;
            }
          }
          return true;
        });
        
        if (builder._action === 'select') {
          result = items.map((item: any) => {
            const copy = { ...item };
            if (typeof builder._select === 'string') {
              if (builder._select.includes('projects!')) {
                const p = db.projects?.find((p: any) => p.id === item.project_id);
                if (p) {
                   const a = db.users?.find((u: any) => u.id === p.agent_id);
                   copy.projects = { ...p, agents: a || null };
                }
              }
              if (builder._select.includes('sender:users')) {
                copy.sender = db.users?.find((u: any) => u.id === item.sender_id) || null;
                copy.agent = db.users?.find((u: any) => u.id === item.agent_id) || null;
              }
              if (builder._select.includes('users!')) {
                copy.users = db.users?.find((u: any) => u.id === (item.uploaded_by || item.author_id)) || null;
              }
              if (builder._select.includes('agents!')) {
                copy.agents = db.agents?.find((a: any) => a.id === item.agent_id) || null;
              }
            }
            return copy;
          });
        } else if (builder._action === 'update') {
          items.forEach(item => {
            Object.assign(item, builder._data);
          });
          result = items;
        } else if (builder._action === 'delete') {
          db[table] = db[table].filter((i: any) => !items.includes(i));
          result = items;
        }
      }
      return { data: result, error: null };
    },
    then: (resolve: any) => {
      return Promise.resolve(builder.execute()).then(resolve);
    },
    single: jest.fn(async () => {
      const res = builder.execute();
      if (res.error) return res;
      if (!res.data || res.data.length === 0) return { data: null, error: { message: 'Row not found' } };
      return { data: res.data[0], error: null };
    }),
    maybeSingle: jest.fn(async () => {
      const res = builder.execute();
      if (res.error) return res;
      return { data: res.data && res.data.length > 0 ? res.data[0] : null, error: null };
    })
  };
  return builder;
};

const mockSupabase = {
  auth: {
    getUser: jest.fn(async (token: string) => {
        if (token === 'mock-token-sender' || token === 'Bearer mock-token-sender' || token.includes('mock-token-sender')) {
          return { data: { user: { id: 'user-1', email: 'sender@test.com' } }, error: null };
        }
        if (token === 'mock-token-agent2' || token === 'Bearer mock-token-agent2' || (token.includes('mock-token-agent2'))) {
          return { data: { user: { id: 'user-2', email: 'agent2@test.com' } }, error: null };
        }
        if (token === 'mock-token-agent' || token === 'Bearer mock-token-agent' || (token.includes('mock-token-agent') && !token.includes('agent2'))) {
          return { data: { user: { id: 'mock-id', email: 'agent@test.com' } }, error: null };
        }
        return { data: { user: null }, error: { message: 'Invalid token' } };
    }),
    signUp: jest.fn(async () => ({ data: { user: { id: 'new-user' } }, error: null })),
    signInWithPassword: jest.fn(async ({ email, password }: any = {}) => {
      if (email === 'wrong@example.com' || password === 'wrongpassword') {
        return { data: { session: null, user: null }, error: { message: 'Invalid credentials' } };
      }
      return { data: { session: { access_token: 'mock-token-sender', refresh_token: 'refresh', expires_in: 3600 }, user: { id: 'user-1', email: 'sender@test.com', full_name: 'Test Sender', role: 'sender', country: 'NG' } }, error: null };
    }),
    refreshSession: jest.fn(async () => ({ data: { session: { access_token: 'new-token' }, user: { id: 'user-1' } }, error: null })),
    updateUser: jest.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })),
    admin: {
      createUser: jest.fn(async () => ({ data: { user: { id: 'new-user' } }, error: null })),
      listUsers: jest.fn(async () => ({ data: { users: [] }, error: null })),
      updateUserById: jest.fn(async () => ({ data: { user: {} }, error: null })),
    }
  },
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn(async () => ({ data: { path: 'path' }, error: null })),
      getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'http://mock-url.com' } }))
    }))
  },
  rpc: jest.fn(async () => ({ data: null, error: null })),
  from: jest.fn((table: string) => createQueryBuilder(table))
};

jest.mock('../src/config/supabase.config', () => ({
  supabase: mockSupabase
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase)
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn<any>().mockResolvedValue(true)
  })
}));

jest.mock('../src/services/email.service', () => ({
  __esModule: true,
  sendCoFunderInviteEmail: jest.fn<any>().mockResolvedValue(undefined),
}));

jest.mock('../src/services/paystack.service', () => ({
  tokenizeCard: jest.fn(async () => ({ success: true, token: 'fake-token' })),
  resolveBankAccount: jest.fn(async (bankCode: string, accountNumber: string) => {
    if (bankCode === '999') throw new Error('Resolution failed');
    return { accountName: 'Jane Doe', accountNumber: '1234567890', bankName: 'Test Bank' };
  }),
  chargeCard: jest.fn(async () => ({ success: true, reference: 'tx_ref', amount: 5000, currency: 'NGN' })),
  createTransferRecipient: jest.fn(async () => ({ recipientCode: 'RCP_test123' })),
  initiateTransfer: jest.fn(async () => ({ success: true, transferCode: 'TRF_test123', status: 'success' }))
}));

jest.mock('speakeasy', () => ({
  __esModule: true,
  default: {
    generateSecret: jest.fn(() => ({ base32: 'mock-secret', otpauth_url: 'mock-url' })),
    totp: {
      verify: jest.fn(() => true)
    }
  }
}));

jest.mock('qrcode', () => ({
  __esModule: true,
  toDataURL: jest.fn(async () => 'data:image/png;base64,mock')
}));

