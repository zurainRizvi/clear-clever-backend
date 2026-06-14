import request from 'supertest';
import { createApp } from './app';
import { loadEnv, resetEnvCache } from './config/env';
import { Lead } from './models/Lead';
import { InsurerProfile } from './models/InsurerProfile';
import { Policy } from './models/Policy';
import { Purchase } from './models/Purchase';
import { QuestionnaireResponse } from './models/QuestionnaireResponse';
import { User } from './models/User';
import { SEED_DEFAULT_PASSWORD } from './seed/userSeedData';
import { seedAll } from './seed/seedCatalog';
import { applyTestEnv } from './test/setupEnv';
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from './test/mongoSetup';

describe('Insurer analytics intelligence', () => {
  let testMongoUri = '';
  let app: ReturnType<typeof createApp>;
  let tplToken = '';
  let adamjeeToken = '';

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
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'insurer.tpl@clearclever.com', password: SEED_DEFAULT_PASSWORD });
    tplToken = res.body.data.token;
    const adamjeeRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'insurer.adamjee@clearclever.com', password: SEED_DEFAULT_PASSWORD });
    adamjeeToken = adamjeeRes.body.data.token;
  });

  it('returns analytics payload for insurer', async () => {
    const res = await request(app)
      .get('/api/insurer/analytics')
      .set('Authorization', `Bearer ${tplToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.analytics.overviewMetrics).toHaveLength(5);
    expect(res.body.data.analytics.overviewMetrics[0].title).toBe('Active Seekers');
    expect(res.body.data.analytics.overviewMetrics[0].definition).toBeTruthy();
    expect(res.body.data.analytics.funnel.steps).toHaveLength(6);
    expect(res.body.data.analytics.funnel.steps[0].name).toContain('questionnaire');
    expect(res.body.data.analytics.leadSources).toBeInstanceOf(Array);
    expect(res.body.data.analytics.policyPerformance).toBeInstanceOf(Array);
    expect(res.body.data.analytics.operations).toBeInstanceOf(Array);
    expect(res.body.data.analytics.operations.length).toBeGreaterThan(0);
    expect(res.body.data.analytics.competitiveness).toBeUndefined();
    expect(res.body.data.analytics.interestTrends.datasets).toHaveLength(4);
    expect(res.body.data.analytics.usersByRegion).toBeDefined();
    expect(res.body.data.analytics.usersByRegion.regions).toBeInstanceOf(Array);
    expect(res.body.data.analytics.customerDemographics).toBeDefined();
    expect(res.body.data.analytics.customerDemographics.gender).toBeDefined();
  });

  it('accepts from and to query params', async () => {
    const res = await request(app)
      .get('/api/insurer/analytics')
      .query({ from: '2026-05-01', to: '2026-05-18' })
      .set('Authorization', `Bearer ${tplToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.analytics.dateRange.from).toBe('2026-05-01');
    expect(res.body.data.analytics.dateRange.to).toBe('2026-05-18');
  });

  it('builds smart insights from questionnaire and funnel signals', async () => {
    const tplProfile = await InsurerProfile.findOne({ slug: 'tpl-insurance' });
    const seeker = await User.findOne({ email: 'seeker@clearclever.com' });
    const policy = await Policy.findOne({
      insurerProfileId: tplProfile!._id,
      status: 'approved',
    });

    await QuestionnaireResponse.findOneAndUpdate(
      { userId: seeker!._id, category: 'home' },
      {
        userId: seeker!._id,
        category: 'home',
        answers: { home_owner: 'yes', has_pet: 'yes', property_type: 'Apartment' },
        completedQuestionIds: ['home_owner'],
      },
      { upsert: true, new: true }
    );

    await Lead.create({
      insurerProfileId: tplProfile!._id,
      userId: seeker!._id,
      policyId: policy!._id,
      type: 'inquiry',
      status: 'new',
      summary: 'Interested',
      metadata: { source: 'recommend', category: 'home' },
    });

    const res = await request(app)
      .get('/api/insurer/analytics')
      .set('Authorization', `Bearer ${tplToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.analytics.smartInsights.length).toBeGreaterThan(0);
    expect(res.body.data.analytics.smartInsights[0].evidence).toBeTruthy();
    expect(res.body.data.analytics.customerSegments.length).toBeGreaterThan(0);
    expect(res.body.data.analytics.customerSegments[0].seekers).toBeGreaterThan(0);
  });

  it('uses user-level seeker purchase rate not lead-event conversion', async () => {
    const tplProfile = await InsurerProfile.findOne({ slug: 'tpl-insurance' });
    const seeker = await User.findOne({ email: 'seeker@clearclever.com' });
    const policy = await Policy.findOne({
      insurerProfileId: tplProfile!._id,
      status: 'approved',
    });

    await Lead.create({
      insurerProfileId: tplProfile!._id,
      userId: seeker!._id,
      policyId: policy!._id,
      type: 'inquiry',
      status: 'new',
      summary: 'Viewed',
      metadata: { source: 'recommend', category: 'home' },
    });
    await Lead.create({
      insurerProfileId: tplProfile!._id,
      userId: seeker!._id,
      policyId: policy!._id,
      type: 'favorite',
      status: 'new',
      summary: 'Saved',
      metadata: { source: 'favorite', category: 'home' },
    });
    await Lead.create({
      insurerProfileId: tplProfile!._id,
      userId: seeker!._id,
      policyId: policy!._id,
      type: 'purchase',
      status: 'new',
      summary: 'Purchased',
      metadata: { source: 'purchase' },
    });

    const res = await request(app)
      .get('/api/insurer/analytics')
      .set('Authorization', `Bearer ${tplToken}`);

    const rateMetric = res.body.data.analytics.overviewMetrics.find(
      (m: { title: string }) => m.title === 'Seeker → Purchase Rate'
    );
    expect(rateMetric.value).toBe('100%');
    expect(rateMetric.definition).toContain('Unique purchasers');
  });

  it('does not use questionnaire data from seekers who only interacted with another insurer', async () => {
    const tplProfile = await InsurerProfile.findOne({ slug: 'tpl-insurance' });
    const adamjeeProfile = await InsurerProfile.findOne({ slug: 'adamjee-insurance' });
    const seeker = await User.findOne({ email: 'seeker@clearclever.com' });
    const tplPolicy = await Policy.findOne({
      insurerProfileId: tplProfile!._id,
      status: 'approved',
    });

    const now = new Date();

    await QuestionnaireResponse.findOneAndUpdate(
      { userId: seeker!._id, category: 'home' },
      {
        userId: seeker!._id,
        category: 'home',
        answers: {
          home_owner: 'yes',
          has_pet: 'yes',
          property_type: 'Apartment',
          city: 'Karachi',
        },
        completedQuestionIds: ['home_owner'],
        updatedAt: now,
      },
      { upsert: true, new: true, timestamps: false }
    );

    await Lead.create({
      insurerProfileId: tplProfile!._id,
      userId: seeker!._id,
      policyId: tplPolicy!._id,
      type: 'inquiry',
      status: 'new',
      summary: 'Saw TPL home policy',
      metadata: { source: 'recommend', category: 'home' },
      createdAt: now,
    });
    await Lead.create({
      insurerProfileId: tplProfile!._id,
      userId: seeker!._id,
      policyId: tplPolicy!._id,
      type: 'favorite',
      status: 'new',
      summary: 'Saved TPL home policy',
      metadata: { source: 'favorite', category: 'home' },
      createdAt: now,
    });
    await Lead.create({
      insurerProfileId: tplProfile!._id,
      userId: seeker!._id,
      policyId: tplPolicy!._id,
      type: 'purchase',
      status: 'new',
      summary: 'Purchased with TPL',
      metadata: { source: 'purchase' },
      createdAt: now,
    });
    await Purchase.create({
      userId: seeker!._id,
      policyId: tplPolicy!._id,
      insurerProfileId: tplProfile!._id,
      affiliateSlug: tplProfile!.slug,
      answers: {},
      status: 'completed',
      paymentProcessedAt: now,
      completedAt: now,
      completionArtifactsCreated: true,
      createdAt: now,
      updatedAt: now,
    });

    const adamjeeRes = await request(app)
      .get('/api/insurer/analytics')
      .set('Authorization', `Bearer ${adamjeeToken}`);

    expect(adamjeeRes.status).toBe(200);
    expect(adamjeeRes.body.data.analytics.funnel.steps[0].users).toBe(0);
    expect(adamjeeRes.body.data.analytics.smartInsights).toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({
          description: expect.stringContaining('pet ownership'),
        }),
      ])
    );

    const tplRes = await request(app)
      .get('/api/insurer/analytics')
      .set('Authorization', `Bearer ${tplToken}`);

    expect(tplRes.status).toBe(200);
    expect(tplRes.body.data.analytics.funnel.steps[0].users).toBeGreaterThan(0);
    expect(tplRes.body.data.analytics.funnel.steps[5].users).toBeGreaterThan(0);
    expect(
      tplRes.body.data.analytics.usersByRegion.regions.some(
        (r: { slug: string }) => r.slug === 'sindh'
      )
    ).toBe(true);
    expect(String(adamjeeProfile!._id)).not.toBe(String(tplProfile!._id));
  });
});
