import request from 'supertest';
import { createApp } from './app';
import { loadEnv, resetEnvCache } from './config/env';
import { Lead } from './models/Lead';
import { InsurerProfile } from './models/InsurerProfile';
import { Policy } from './models/Policy';
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
  });

  it('returns analytics payload for insurer', async () => {
    const res = await request(app)
      .get('/api/insurer/analytics')
      .set('Authorization', `Bearer ${tplToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.analytics.overviewMetrics).toHaveLength(5);
    expect(res.body.data.analytics.funnel.steps.length).toBeGreaterThan(0);
    expect(res.body.data.analytics.interestTrends.datasets).toHaveLength(4);
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
    });

    const res = await request(app)
      .get('/api/insurer/analytics')
      .set('Authorization', `Bearer ${tplToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.analytics.smartInsights.length).toBeGreaterThan(0);
    expect(res.body.data.analytics.customerSegments.length).toBeGreaterThan(0);
  });
});
