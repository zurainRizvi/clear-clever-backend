import request from 'supertest';
import { createApp } from './app';
import { loadEnv, resetEnvCache } from './config/env';
import { InsurerProfile } from './models/InsurerProfile';
import { Lead } from './models/Lead';
import { Policy } from './models/Policy';
import { User } from './models/User';
import { SEED_DEFAULT_PASSWORD } from './seed/userSeedData';
import { seedAll } from './seed/seedCatalog';
import { applyTestEnv } from './test/setupEnv';
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from './test/mongoSetup';

describe('Module 6 — Insurer & admin modules', () => {
  let testMongoUri = '';
  let app: ReturnType<typeof createApp>;
  let tplToken = '';
  let jubileeToken = '';
  let adminToken = '';
  let seekerToken = '';

  async function login(email: string): Promise<string> {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: SEED_DEFAULT_PASSWORD });
    return res.body.data.token;
  }

  const newPolicyPayload = {
    slug: 'tpl-custom-home-plan',
    name: 'TPL Custom Home Plan',
    category: 'home',
    description: 'Custom home cover created by insurer during tests.',
    premiumMonthlyPkr: 4200,
    premiumYearlyPkr: 47000,
    coverageSummary: 'Fire, theft, and natural disaster cover for urban homes.',
    features: ['Fire cover', 'Theft cover'],
    deductiblePkr: 15000,
    questions: [
      {
        id: 'property_type',
        text: 'Property type?',
        type: 'single',
        options: ['Apartment', 'House'],
        required: true,
      },
    ],
  };

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
    tplToken = await login('insurer.tpl@clearclever.com');
    jubileeToken = await login('insurer.jubilee@clearclever.com');
    adminToken = await login('admin@clearclever.com');
    seekerToken = await login('seeker@clearclever.com');
  });

  describe('Insurer policy CRUD', () => {
    it('creates a policy in pending status', async () => {
      const res = await request(app)
        .post('/api/insurer/policies')
        .set('Authorization', `Bearer ${tplToken}`)
        .send(newPolicyPayload);

      expect(res.status).toBe(201);
      expect(res.body.data.policy.status).toBe('pending');

      const stored = await Policy.findOne({ slug: newPolicyPayload.slug });
      expect(stored?.status).toBe('pending');
    });

    it('lists only policies owned by the authenticated insurer', async () => {
      const createRes = await request(app)
        .post('/api/insurer/policies')
        .set('Authorization', `Bearer ${tplToken}`)
        .send(newPolicyPayload);

      const listRes = await request(app)
        .get('/api/insurer/policies')
        .set('Authorization', `Bearer ${tplToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.policies.some((p: { id: string }) => p.id === createRes.body.data.policy.id)).toBe(
        true
      );
    });

    it('excludes pending insurer policy from recommend until approved', async () => {
      const createRes = await request(app)
        .post('/api/insurer/policies')
        .set('Authorization', `Bearer ${tplToken}`)
        .send(newPolicyPayload);

      const policyId = createRes.body.data.policy.id;

      const recommendBefore = await request(app)
        .post('/api/recommend')
        .send({
          category: 'home',
          answers: {
            property_type: 'Apartment',
            occupancy: 'Owner occupied',
            property_value_pkr: 5000000,
            contents_cover: 'Yes — full contents',
            city: 'Karachi',
          },
        });

      const idsBefore = recommendBefore.body.data.recommendations.map(
        (item: { policy: { id: string } }) => item.policy.id
      );
      expect(idsBefore).not.toContain(policyId);

      await request(app)
        .post(`/api/admin/policies/${policyId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      const recommendAfter = await request(app)
        .post('/api/recommend')
        .send({
          category: 'home',
          answers: {
            property_type: 'Apartment',
            occupancy: 'Owner occupied',
            property_value_pkr: 5000000,
            contents_cover: 'Yes — full contents',
            city: 'Karachi',
          },
        });

      const idsAfter = recommendAfter.body.data.recommendations.map(
        (item: { policy: { id: string } }) => item.policy.id
      );
      expect(idsAfter).toContain(policyId);
    });

    it('returns 403 when insurer edits another insurer policy', async () => {
      const createRes = await request(app)
        .post('/api/insurer/policies')
        .set('Authorization', `Bearer ${tplToken}`)
        .send(newPolicyPayload);

      const res = await request(app)
        .put(`/api/insurer/policies/${createRes.body.data.policy.id}`)
        .set('Authorization', `Bearer ${jubileeToken}`)
        .send({ name: 'Hijacked policy name' });

      expect(res.status).toBe(403);
    });

    it('resubmits updated policy as pending', async () => {
      const createRes = await request(app)
        .post('/api/insurer/policies')
        .set('Authorization', `Bearer ${tplToken}`)
        .send(newPolicyPayload);

      await request(app)
        .post(`/api/admin/policies/${createRes.body.data.policy.id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      const updateRes = await request(app)
        .put(`/api/insurer/policies/${createRes.body.data.policy.id}`)
        .set('Authorization', `Bearer ${tplToken}`)
        .send({ name: 'TPL Custom Home Plan (revised)' });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.policy.status).toBe('pending');
    });
  });

  describe('Insurer leads', () => {
    it('returns leads scoped to the insurer profile', async () => {
      const tplProfile = await InsurerProfile.findOne({ slug: 'tpl-insurance' });
      const seeker = await User.findOne({ email: 'seeker@clearclever.com' });
      const policy = await Policy.findOne({ slug: 'tpl-home-essential' });

      await Lead.create({
        insurerProfileId: tplProfile!._id,
        userId: seeker!._id,
        policyId: policy!._id,
        type: 'inquiry',
        status: 'new',
        summary: 'Interested in home essential plan',
      });

      const res = await request(app)
        .get('/api/insurer/leads')
        .set('Authorization', `Bearer ${tplToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(1);
      expect(res.body.data.leads[0].seeker.email).toBe('seeker@clearclever.com');
      expect(res.body.data.leads[0].policy.slug).toBe('tpl-home-essential');
    });
  });

  describe('Admin policy moderation', () => {
    it('lists pending policies for admin review', async () => {
      const res = await request(app)
        .get('/api/admin/policies/pending')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBeGreaterThan(0);
      expect(res.body.data.policies.every((p: { status: string }) => p.status === 'pending')).toBe(
        true
      );
    });

    it('approves and rejects policies with optional reason', async () => {
      const createRes = await request(app)
        .post('/api/insurer/policies')
        .set('Authorization', `Bearer ${tplToken}`)
        .send({
          ...newPolicyPayload,
          slug: 'tpl-reject-demo-plan',
          name: 'TPL Reject Demo Plan',
        });

      const policyId = createRes.body.data.policy.id;

      const approveRes = await request(app)
        .post(`/api/admin/policies/${policyId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.policy.status).toBe('approved');

      const rejectRes = await request(app)
        .post(`/api/admin/policies/${policyId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Needs more underwriting detail' });

      expect(rejectRes.status).toBe(200);
      expect(rejectRes.body.data.policy.status).toBe('rejected');
      expect(rejectRes.body.data.policy.rejectionReason).toBe('Needs more underwriting detail');
    });
  });

  describe('Admin users & analytics', () => {
    it('lists users and updates role', async () => {
      const seeker = await User.findOne({ email: 'seeker@clearclever.com' });

      const listRes = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.users.some((u: { email: string }) => u.email === 'seeker@clearclever.com')).toBe(
        true
      );

      const roleRes = await request(app)
        .patch(`/api/admin/users/${seeker!._id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'insurer' });

      expect(roleRes.status).toBe(200);
      expect(roleRes.body.data.user.role).toBe('insurer');
    });

    it('deactivates a user account', async () => {
      const seeker = await User.findOne({ email: 'seeker@clearclever.com' });

      const res = await request(app)
        .patch(`/api/admin/users/${seeker!._id}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.status).toBe('inactive');

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'seeker@clearclever.com', password: SEED_DEFAULT_PASSWORD });

      expect(loginRes.status).toBe(403);
    });

    it('returns analytics counts', async () => {
      const res = await request(app)
        .get('/api/admin/analytics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.users.total).toBeGreaterThan(0);
      expect(res.body.data.policies.approved).toBeGreaterThan(0);
    });
  });

  describe('RBAC', () => {
    it('returns 403 when a seeker hits admin approve', async () => {
      const pending = await Policy.findOne({ status: 'pending' });
      expect(pending).toBeTruthy();

      const res = await request(app)
        .post(`/api/admin/policies/${pending!._id}/approve`)
        .set('Authorization', `Bearer ${seekerToken}`);

      expect(res.status).toBe(403);
    });

    it('returns 403 when a seeker hits insurer policy create', async () => {
      const res = await request(app)
        .post('/api/insurer/policies')
        .set('Authorization', `Bearer ${seekerToken}`)
        .send(newPolicyPayload);

      expect(res.status).toBe(403);
    });

    it('allows superadmin to access admin routes', async () => {
      const superToken = await login('superadmin@clearclever.com');

      const res = await request(app)
        .get('/api/admin/analytics')
        .set('Authorization', `Bearer ${superToken}`);

      expect(res.status).toBe(200);
    });
  });
});
