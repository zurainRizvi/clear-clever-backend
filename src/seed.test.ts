import request from 'supertest';
import { createApp } from './app';
import { loadEnv, resetEnvCache } from './config/env';
import { User } from './models/User';
import { SEED_DEFAULT_PASSWORD, SEED_USERS } from './seed/userSeedData';
import { seedUsers } from './seed/seedUsers';
import { applyTestEnv } from './test/setupEnv';
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from './test/mongoSetup';

describe('Module 3 — User seed', () => {
  let testMongoUri = '';

  beforeAll(async () => {
    testMongoUri = await connectTestDatabase();
    applyTestEnv({ MONGODB_URI: testMongoUri });
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    applyTestEnv({ MONGODB_URI: testMongoUri });
    resetEnvCache();
  });

  it('seed is idempotent and creates all demo accounts', async () => {
    const first = await seedUsers();
    expect(first.created).toBe(SEED_USERS.length);
    expect(first.updated).toBe(0);

    const second = await seedUsers();
    expect(second.created).toBe(0);
    expect(second.updated).toBe(SEED_USERS.length);

    const count = await User.countDocuments();
    expect(count).toBe(SEED_USERS.length);
  });

  it('seeded admin can log in without OTP', async () => {
    await seedUsers();

    const env = loadEnv();
    const app = createApp(env);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@clearclever.com', password: SEED_DEFAULT_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.role).toBe('admin');
    expect(res.body.data.user.status).toBe('active');
  });

  it('seeded insurer accounts have insurer role', async () => {
    await seedUsers();

    const tpl = await User.findOne({ email: 'insurer.tpl@clearclever.com' });
    expect(tpl?.role).toBe('insurer');
    expect(tpl?.fullName).toBe('Ahmed Hassan');
  });
});
