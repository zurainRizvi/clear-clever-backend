import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from './app';
import { loadEnv, resetEnvCache } from './config/env';
import { ClaimRequest } from './models/ClaimRequest';
import { InsurerProfile } from './models/InsurerProfile';
import { Lead } from './models/Lead';
import { Notification } from './models/Notification';
import { Policy } from './models/Policy';
import { Purchase } from './models/Purchase';
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

  describe('Insurer profile', () => {
    it('returns the linked insurer profile', async () => {
      const res = await request(app)
        .get('/api/insurer/profile')
        .set('Authorization', `Bearer ${tplToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.profile.companyName).toBe('TPL Insurance');
      expect(res.body.data.profile.slug).toBe('tpl-insurance');
    });

    it('updates contact fields on the insurer profile', async () => {
      const res = await request(app)
        .patch('/api/insurer/profile')
        .set('Authorization', `Bearer ${tplToken}`)
        .send({
          contactEmail: 'updated@tplinsurance.com.pk',
          contactPhone: '+923001112233',
          description: 'Updated provider description for tests.',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.profile.contactEmail).toBe('updated@tplinsurance.com.pk');
    });
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

  describe('Insurer claims', () => {
    it('lists claims for the insurer and updates review status', async () => {
      const tplProfile = await InsurerProfile.findOne({ slug: 'tpl-insurance' });
      const seeker = await User.findOne({ email: 'seeker@clearclever.com' });
      const policy = await Policy.findOne({ insurerProfileId: tplProfile!._id, status: 'approved' });
      const purchase =
        (await Purchase.findOne({
          userId: seeker!._id,
          policyId: policy!._id,
          status: 'completed',
        })) ??
        (await Purchase.create({
          userId: seeker!._id,
          policyId: policy!._id,
          insurerProfileId: tplProfile!._id,
          status: 'completed',
          affiliateSlug: tplProfile!.slug,
          answers: {},
          completionArtifactsCreated: true,
          completedAt: new Date(),
        }));

      const claim = await ClaimRequest.create({
        userId: seeker!._id,
        purchaseId: purchase._id,
        policyId: policy!._id,
        insurerProfileId: tplProfile!._id,
        claimType: 'damage',
        incidentDate: new Date(),
        estimatedAmountPkr: 50000,
        description: 'Ceiling damage after rain for insurer review flow.',
        status: 'submitted',
      });

      const listRes = await request(app)
        .get('/api/insurer/claims')
        .set('Authorization', `Bearer ${tplToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.claims.some((item: { id: string }) => item.id === String(claim._id))).toBe(
        true
      );
      expect(listRes.body.data.claims[0].seeker?.email).toBe('seeker@clearclever.com');

      const reviewRes = await request(app)
        .patch(`/api/insurer/claims/${claim._id}`)
        .set('Authorization', `Bearer ${tplToken}`)
        .send({ status: 'in_review' });

      expect(reviewRes.status).toBe(200);
      expect(reviewRes.body.data.claim.status).toBe('in_review');

      const approveRes = await request(app)
        .patch(`/api/insurer/claims/${claim._id}`)
        .set('Authorization', `Bearer ${tplToken}`)
        .send({ status: 'approved' });

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.claim.status).toBe('approved');

      const seekerList = await request(app)
        .get('/api/claims')
        .set('Authorization', `Bearer ${seekerToken}`);

      const seekerClaim = seekerList.body.data.claims.find(
        (item: { id: string }) => item.id === String(claim._id)
      );
      expect(seekerClaim.status).toBe('approved');

      const revertRes = await request(app)
        .patch(`/api/insurer/claims/${claim._id}`)
        .set('Authorization', `Bearer ${tplToken}`)
        .send({ status: 'in_review', revert: true });

      expect(revertRes.status).toBe(200);
      expect(revertRes.body.data.claim.status).toBe('in_review');
    });

    it('returns 403 when another insurer updates a claim', async () => {
      const tplProfile = await InsurerProfile.findOne({ slug: 'tpl-insurance' });
      const seeker = await User.findOne({ email: 'seeker@clearclever.com' });
      const policy = await Policy.findOne({ insurerProfileId: tplProfile!._id });

      const claim = await ClaimRequest.create({
        userId: seeker!._id,
        purchaseId: new mongoose.Types.ObjectId(),
        policyId: policy!._id,
        insurerProfileId: tplProfile!._id,
        claimType: 'theft',
        incidentDate: new Date(),
        description: 'Stolen items claim.',
        status: 'submitted',
      });

      const res = await request(app)
        .patch(`/api/insurer/claims/${claim._id}`)
        .set('Authorization', `Bearer ${jubileeToken}`)
        .send({ status: 'approved' });

      expect(res.status).toBe(404);
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
      expect(res.body.data.leads[0].isNew).toBe(true);
    });

    it('does not return leads belonging to another insurer', async () => {
      const tplProfile = await InsurerProfile.findOne({ slug: 'tpl-insurance' });
      const adamjeeProfile = await InsurerProfile.findOne({ slug: 'adamjee-insurance' });
      const seeker = await User.findOne({ email: 'seeker@clearclever.com' });
      const tplPolicy = await Policy.findOne({ slug: 'tpl-home-essential' });

      await Lead.create({
        insurerProfileId: tplProfile!._id,
        userId: seeker!._id,
        policyId: tplPolicy!._id,
        type: 'purchase',
        status: 'new',
        summary: 'Purchased TPL home essential',
      });

      const adamjeeToken = await login('insurer.adamjee@clearclever.com');
      const res = await request(app)
        .get('/api/insurer/leads')
        .set('Authorization', `Bearer ${adamjeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(0);
      expect(
        res.body.data.leads.some(
          (lead: { seeker?: { email?: string } }) => lead.seeker?.email === 'seeker@clearclever.com'
        )
      ).toBe(false);

      const tplRes = await request(app)
        .get('/api/insurer/leads')
        .set('Authorization', `Bearer ${tplToken}`);

      expect(tplRes.status).toBe(200);
      expect(tplRes.body.data.count).toBe(1);
      expect(tplRes.body.data.leads[0].policy.slug).toBe('tpl-home-essential');
      expect(String(adamjeeProfile!._id)).not.toBe(String(tplProfile!._id));
    });

    it('marks a lead as seen', async () => {
      const tplProfile = await InsurerProfile.findOne({ slug: 'tpl-insurance' });
      const seeker = await User.findOne({ email: 'seeker@clearclever.com' });
      const lead = await Lead.create({
        insurerProfileId: tplProfile!._id,
        userId: seeker!._id,
        type: 'favorite',
        status: 'new',
        summary: 'Saved a policy',
      });

      const res = await request(app)
        .patch(`/api/insurer/leads/${lead._id}/seen`)
        .set('Authorization', `Bearer ${tplToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.lead.isNew).toBe(false);
      expect(res.body.data.lead.seenAt).toBeTruthy();
    });
  });

  describe('Insurer policy delete', () => {
    it('deletes a policy with no purchases or claims', async () => {
      const createRes = await request(app)
        .post('/api/insurer/policies')
        .set('Authorization', `Bearer ${tplToken}`)
        .send({
          ...newPolicyPayload,
          slug: 'tpl-delete-me-plan',
          name: 'TPL Delete Me Plan',
        });

      const policyId = createRes.body.data.policy.id;

      const res = await request(app)
        .delete(`/api/insurer/policies/${policyId}`)
        .set('Authorization', `Bearer ${tplToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.policyId).toBe(policyId);
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

      const tplProfile = await InsurerProfile.findOne({ slug: 'tpl-insurance' });
      const notice = await Notification.findOne({
        userId: tplProfile!.userId,
        type: 'policy_review',
      });
      expect(notice?.title).toBe('Policy needs revision');
      expect(notice?.body).toContain('Needs more underwriting detail');
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

    it('reactivates a deactivated user account', async () => {
      const seeker = await User.findOne({ email: 'seeker@clearclever.com' });

      await request(app)
        .patch(`/api/admin/users/${seeker!._id}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`);

      const reactivateRes = await request(app)
        .patch(`/api/admin/users/${seeker!._id}/reactivate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(reactivateRes.status).toBe(200);
      expect(reactivateRes.body.data.user.status).toBe('active');

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'seeker@clearclever.com', password: SEED_DEFAULT_PASSWORD });

      expect(loginRes.status).toBe(200);
    });

    it('hides superadmin accounts from admin user list', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(
        res.body.data.users.every((user: { role: string }) => user.role !== 'superadmin')
      ).toBe(true);
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
      expect(res.body.data.platform).toBeDefined();
      expect(res.body.data.platform.insurers.total).toBeGreaterThan(0);
    });

    it('returns superadmin system health with assistant metrics', async () => {
      const superToken = await login('superadmin@clearclever.com');

      const res = await request(app)
        .get('/api/admin/health')
        .set('Authorization', `Bearer ${superToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.infrastructure.gemini).toBeDefined();
      expect(res.body.data.assistant).toBeDefined();
      expect(res.body.data.assistant.usage).toBeDefined();
      expect(Array.isArray(res.body.data.assistant.diagnostics)).toBe(true);
    });

    it('returns 403 when admin hits superadmin-only system health', async () => {
      const res = await request(app)
        .get('/api/admin/health')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
    });

    it('returns 403 when admin tries superadmin-only insurer delete', async () => {
      const insurer = await User.findOne({ email: 'insurer.adamjee@clearclever.com' });

      const res = await request(app)
        .delete(`/api/admin/insurers/${insurer!._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('Superadmin provider management', () => {
    let superToken = '';

    beforeEach(async () => {
      superToken = await login('superadmin@clearclever.com');
    });

    it('lists insurers with profile summaries', async () => {
      const res = await request(app)
        .get('/api/admin/insurers')
        .set('Authorization', `Bearer ${superToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.insurers.length).toBeGreaterThan(0);
      const withProfile = res.body.data.insurers.find(
        (entry: { profile?: { companyName?: string } }) => entry.profile?.companyName
      );
      expect(withProfile).toBeTruthy();
      const pendingOnly = res.body.data.insurers.find(
        (entry: { user: { email: string }; profile: unknown }) =>
          entry.user.email === 'insurer.pending@clearclever.com'
      );
      expect(pendingOnly?.profile).toBeNull();
    });

    it('approves, revokes, and permanently deletes a pending provider', async () => {
      const pendingUser = await User.create({
        fullName: 'Pending Provider Co',
        email: 'pending.provider@clearclever.com',
        phone: '+923099887766',
        passwordHash: await hashPassword(SEED_DEFAULT_PASSWORD),
        role: 'insurer',
        status: 'pendingVerification',
      });
      const pendingProfile = await InsurerProfile.create({
        userId: pendingUser._id,
        companyName: 'Pending Provider Co',
        slug: 'pending-provider-co',
        contactEmail: 'pending.provider@clearclever.com',
        contactPhone: '+923099887766',
      });
      await Policy.create({
        insurerProfileId: pendingProfile._id,
        slug: 'pending-demo-policy',
        name: 'Pending Demo Policy',
        category: 'auto',
        description: 'Demo policy for provider approval tests.',
        premiumMonthlyPkr: 3000,
        premiumYearlyPkr: 33000,
        coverageSummary: 'Test cover',
        features: ['Test'],
        deductiblePkr: 5000,
        questions: [],
        status: 'pending',
      });

      const approveRes = await request(app)
        .post(`/api/admin/insurers/${pendingUser._id}/approve`)
        .set('Authorization', `Bearer ${superToken}`);

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.user.status).toBe('active');

      const revokeRes = await request(app)
        .post(`/api/admin/insurers/${pendingUser._id}/revoke`)
        .set('Authorization', `Bearer ${superToken}`);

      expect(revokeRes.status).toBe(200);
      expect(revokeRes.body.data.user.status).toBe('inactive');

      const deleteRes = await request(app)
        .delete(`/api/admin/insurers/${pendingUser._id}`)
        .set('Authorization', `Bearer ${superToken}`);

      expect(deleteRes.status).toBe(200);
      expect(await User.findById(pendingUser._id)).toBeNull();
      expect(await InsurerProfile.findById(pendingProfile._id)).toBeNull();
      expect(await Policy.findOne({ slug: 'pending-demo-policy' })).toBeNull();
    });

    it('rejects a pending provider application', async () => {
      const pendingUser = await User.create({
        fullName: 'Reject Provider Co',
        email: 'reject.provider@clearclever.com',
        phone: '+923088776655',
        passwordHash: await hashPassword(SEED_DEFAULT_PASSWORD),
        role: 'insurer',
        status: 'pendingVerification',
      });
      await InsurerProfile.create({
        userId: pendingUser._id,
        companyName: 'Reject Provider Co',
        slug: 'reject-provider-co',
        contactEmail: 'reject.provider@clearclever.com',
        contactPhone: '+923088776655',
      });

      const res = await request(app)
        .post(`/api/admin/insurers/${pendingUser._id}/reject`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ reason: 'Incomplete documentation' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.status).toBe('inactive');

      const notice = await Notification.findOne({
        userId: pendingUser._id,
        type: 'account_review',
      });
      expect(notice?.body).toContain('Incomplete documentation');
    });
  });

  describe('Audit logs', () => {
    it('lists audit events for superadmin', async () => {
      const superToken = await login('superadmin@clearclever.com');

      const res = await request(app)
        .get('/api/admin/audit')
        .set('Authorization', `Bearer ${superToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.events)).toBe(true);
      expect(res.body.data.events.length).toBeGreaterThan(0);
    });

    it('clears audit logs for superadmin', async () => {
      const superToken = await login('superadmin@clearclever.com');

      const listRes = await request(app)
        .get('/api/admin/audit')
        .set('Authorization', `Bearer ${superToken}`);
      expect(listRes.body.data.events.length).toBeGreaterThan(0);

      const clearRes = await request(app)
        .delete('/api/admin/audit')
        .set('Authorization', `Bearer ${superToken}`);

      expect(clearRes.status).toBe(200);
      expect(clearRes.body.data.deletedCount).toBeGreaterThan(0);

      const afterRes = await request(app)
        .get('/api/admin/audit')
        .set('Authorization', `Bearer ${superToken}`);

      expect(afterRes.status).toBe(200);
      expect(afterRes.body.data.events).toEqual([]);
    });

    it('returns 403 when admin hits superadmin-only audit routes', async () => {
      const res = await request(app)
        .get('/api/admin/audit')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('Fraud signals', () => {
    it('returns fraud signals for admin', async () => {
      const res = await request(app)
        .get('/api/admin/fraud-signals?category=account')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.category).toBe('account');
      expect(Array.isArray(res.body.data.signals)).toBe(true);
    });
  });

  describe('Support contact', () => {
    it('accepts a support inquiry from authenticated user', async () => {
      const res = await request(app)
        .post('/api/support/contact')
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({
          fullName: 'Test Seeker',
          email: 'seeker@clearclever.com',
          roleLabel: 'policy_seeker',
          reason: 'technical',
          message: 'I need help with my dashboard settings please.',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.inquiry.id).toBeTruthy();
    });
  });
});
