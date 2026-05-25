import request from 'supertest';
import { createApp } from './app';
import { loadEnv, resetEnvCache } from './config/env';
import { InsurerProfile } from './models/InsurerProfile';
import { Lead } from './models/Lead';
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

describe('Insurer dashboard intelligence', () => {
  let testMongoUri = '';
  let app: ReturnType<typeof createApp>;
  let tplToken = '';
  let seekerToken = '';

  async function login(email: string): Promise<string> {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: SEED_DEFAULT_PASSWORD });
    return res.body.data.token;
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
    tplToken = await login('insurer.tpl@clearclever.com');
    seekerToken = await login('seeker@clearclever.com');
  });

  it('returns dashboard intelligence for the authenticated insurer', async () => {
    const res = await request(app)
      .get('/api/insurer/dashboard')
      .set('Authorization', `Bearer ${tplToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.dashboard.overviewStats).toHaveLength(6);
    expect(res.body.data.dashboard.smartInsights).toBeInstanceOf(Array);
    expect(res.body.data.dashboard.dateRange.label).toBeTruthy();
  });

  it('uses questionnaire and lead data to produce smart insights', async () => {
    const tplProfile = await InsurerProfile.findOne({ slug: 'tpl-insurance' });
    const seeker = await User.findOne({ email: 'seeker@clearclever.com' });
    const homePolicy = await Policy.findOne({
      insurerProfileId: tplProfile!._id,
      category: 'home',
      status: 'approved',
    });

    await QuestionnaireResponse.findOneAndUpdate(
      { userId: seeker!._id, category: 'home' },
      {
        userId: seeker!._id,
        category: 'home',
        answers: {
          home_owner: 'yes',
          property_type: 'Apartment',
          has_pet: 'yes',
          pet_type: 'Dog',
        },
        completedQuestionIds: ['home_owner', 'property_type', 'has_pet'],
      },
      { upsert: true, new: true }
    );

    await Lead.create({
      insurerProfileId: tplProfile!._id,
      userId: seeker!._id,
      policyId: homePolicy!._id,
      type: 'inquiry',
      status: 'new',
      summary: 'Interested in home cover',
    });

    await Lead.create({
      insurerProfileId: tplProfile!._id,
      userId: seeker!._id,
      policyId: homePolicy!._id,
      type: 'favorite',
      status: 'new',
      summary: 'Saved home policy',
    });

    const res = await request(app)
      .get('/api/insurer/dashboard')
      .set('Authorization', `Bearer ${tplToken}`);

    expect(res.status).toBe(200);
    const { dashboard } = res.body.data;
    expect(dashboard.overviewStats.some((s: { title: string }) => s.title === 'New Leads')).toBe(
      true
    );
    expect(dashboard.smartInsights.length).toBeGreaterThan(0);
    expect(
      dashboard.smartInsights.some(
        (item: { badge: string }) =>
          item.badge === 'High Demand' ||
          item.badge === 'Bundle Opportunity' ||
          item.badge === 'Pricing Suggestion'
      )
    ).toBe(true);
    expect(dashboard.recentLeads.length).toBeGreaterThan(0);
  });

  it('returns 403 for seekers', async () => {
    const res = await request(app)
      .get('/api/insurer/dashboard')
      .set('Authorization', `Bearer ${seekerToken}`);

    expect(res.status).toBe(403);
  });
});
