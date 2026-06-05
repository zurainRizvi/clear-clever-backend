import request from 'supertest';
import { createApp } from './app';
import { loadEnv, resetEnvCache } from './config/env';
import { InsurerProfile } from './models/InsurerProfile';
import { Policy } from './models/Policy';
import { User } from './models/User';
import { SEED_DEFAULT_PASSWORD } from './seed/userSeedData';
import { seedAll } from './seed/seedCatalog';
import { hashPassword } from './services/auth';
import { applyTestEnv } from './test/setupEnv';
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from './test/mongoSetup';

describe('Insurer portal onboarding', () => {
  let testMongoUri = '';
  let app: ReturnType<typeof createApp>;
  let superToken = '';

  async function login(email: string, password = SEED_DEFAULT_PASSWORD): Promise<string> {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password });
    return res.body.data.token;
  }

  async function createVerifiedSeeker(email: string) {
    const passwordHash = await hashPassword('password12');
    const user = await User.create({
      fullName: 'New Provider',
      email,
      phone: '+923001112233',
      passwordHash,
      role: 'user',
      status: 'active',
    });
    return user;
  }

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
    await seedAll();
    app = createApp(loadEnv());
    superToken = await login('superadmin@clearclever.com');
  });

  it("sets insurer role to pendingVerification", async () => {
    const seeker = await createVerifiedSeeker('new.provider@clearclever.com');
    const token = await login('new.provider@clearclever.com', 'password12');

    const roleRes = await request(app)
      .patch('/api/auth/role')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'insurer' });

    expect(roleRes.status).toBe(200);
    expect(roleRes.body.data.user.role).toBe('insurer');
    expect(roleRes.body.data.user.status).toBe('pendingVerification');
    expect(roleRes.body.data.user.insurerOnboarding).toEqual({ hasProfile: false });

    const updated = await User.findById(seeker._id);
    expect(updated?.status).toBe('pendingVerification');
  });

  it('allows pending insurers to sign in', async () => {
    await User.create({
      fullName: 'Pending Insurer',
      email: 'pending.insurer@clearclever.com',
      phone: '+923001112244',
      passwordHash: await hashPassword(SEED_DEFAULT_PASSWORD),
      role: 'insurer',
      status: 'pendingVerification',
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'pending.insurer@clearclever.com', password: SEED_DEFAULT_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.user.insurerOnboarding).toEqual({ hasProfile: false });
  });

  it('creates insurer profile with starter policies', async () => {
    await User.create({
      fullName: 'Setup Provider',
      email: 'setup.provider@clearclever.com',
      phone: '+923001112255',
      passwordHash: await hashPassword(SEED_DEFAULT_PASSWORD),
      role: 'insurer',
      status: 'pendingVerification',
    });
    const token = await login('setup.provider@clearclever.com');

    const res = await request(app)
      .post('/api/insurer/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        companyName: 'Setup Insurance Co',
        slug: 'setup-insurance-co',
        contactPhone: '+923001112255',
        description: 'A new provider onboarding through tests.',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.profile.companyName).toBe('Setup Insurance Co');
    expect(res.body.data.policiesCreated).toBe(4);

    const policies = await Policy.find({ slug: /setup-insurance-co-/ });
    expect(policies).toHaveLength(4);
    expect(policies.every((policy) => policy.status === 'pending')).toBe(true);
    expect(policies.map((policy) => policy.category).sort()).toEqual(
      ['auto', 'home', 'life', 'pet'].sort()
    );
  });

  it('returns 409 when creating a duplicate insurer profile', async () => {
    await User.create({
      fullName: 'Duplicate Provider',
      email: 'duplicate.provider@clearclever.com',
      phone: '+923001112266',
      passwordHash: await hashPassword(SEED_DEFAULT_PASSWORD),
      role: 'insurer',
      status: 'pendingVerification',
    });
    const token = await login('duplicate.provider@clearclever.com');

    const first = await request(app)
      .post('/api/insurer/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        companyName: 'Duplicate Insurance Co',
        slug: 'duplicate-insurance-co',
        contactPhone: '+923001112266',
      });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/insurer/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        companyName: 'Duplicate Insurance Co',
        slug: 'duplicate-insurance-co-2',
        contactPhone: '+923001112266',
      });
    expect(second.status).toBe(409);
  });

  it('returns 409 when portal slug is already taken', async () => {
    await User.create({
      fullName: 'Slug Provider A',
      email: 'slug.provider.a@clearclever.com',
      phone: '+923001112277',
      passwordHash: await hashPassword(SEED_DEFAULT_PASSWORD),
      role: 'insurer',
      status: 'pendingVerification',
    });
    await User.create({
      fullName: 'Slug Provider B',
      email: 'slug.provider.b@clearclever.com',
      phone: '+923001112288',
      passwordHash: await hashPassword(SEED_DEFAULT_PASSWORD),
      role: 'insurer',
      status: 'pendingVerification',
    });

    const tokenA = await login('slug.provider.a@clearclever.com');
    const tokenB = await login('slug.provider.b@clearclever.com');

    const first = await request(app)
      .post('/api/insurer/profile')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        companyName: 'Slug Insurance A',
        slug: 'shared-portal-slug',
        contactPhone: '+923001112277',
      });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/insurer/profile')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        companyName: 'Slug Insurance B',
        slug: 'shared-portal-slug',
        contactPhone: '+923001112288',
      });
    expect(second.status).toBe(409);
  });

  it('blocks dashboard APIs until superadmin approval', async () => {
    const user = await User.create({
      fullName: 'Blocked Provider',
      email: 'blocked.provider@clearclever.com',
      phone: '+923001112299',
      passwordHash: await hashPassword(SEED_DEFAULT_PASSWORD),
      role: 'insurer',
      status: 'pendingVerification',
    });
    const token = await login('blocked.provider@clearclever.com');

    await request(app)
      .post('/api/insurer/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        companyName: 'Blocked Insurance Co',
        slug: 'blocked-insurance-co',
        contactPhone: '+923001112299',
      });

    const policiesRes = await request(app)
      .get('/api/insurer/policies')
      .set('Authorization', `Bearer ${token}`);
    expect(policiesRes.status).toBe(403);
    expect(policiesRes.body.message).toMatch(/awaiting admin approval/i);

    const approveRes = await request(app)
      .post(`/api/admin/insurers/${user._id}/approve`)
      .set('Authorization', `Bearer ${superToken}`);
    expect(approveRes.status).toBe(200);

    const policiesAfter = await request(app)
      .get('/api/insurer/policies')
      .set('Authorization', `Bearer ${token}`);
    expect(policiesAfter.status).toBe(200);
    expect(policiesAfter.body.data.count).toBe(4);
  });

  it('exposes insurer onboarding state on /api/auth/me', async () => {
    const user = await User.create({
      fullName: 'Me Provider',
      email: 'me.provider@clearclever.com',
      phone: '+923001113300',
      passwordHash: await hashPassword(SEED_DEFAULT_PASSWORD),
      role: 'insurer',
      status: 'pendingVerification',
    });
    const token = await login('me.provider@clearclever.com');

    const before = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(before.body.data.user.insurerOnboarding).toEqual({ hasProfile: false });

    await InsurerProfile.create({
      userId: user._id,
      companyName: 'Me Insurance Co',
      slug: 'me-insurance-co',
      contactEmail: 'me.provider@clearclever.com',
      contactPhone: '+923001113300',
    });

    const after = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(after.body.data.user.insurerOnboarding).toEqual({
      hasProfile: true,
      companyName: 'Me Insurance Co',
      slug: 'me-insurance-co',
    });
  });
});
