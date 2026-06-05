import request from 'supertest';
import { createApp } from './app';
import { loadEnv, resetEnvCache } from './config/env';
import { Policy } from './models/Policy';
import { Favorite } from './models/Favorite';
import { Lead } from './models/Lead';
import { SEED_DEFAULT_PASSWORD } from './seed/userSeedData';
import { seedAll } from './seed/seedCatalog';
import { applyTestEnv } from './test/setupEnv';
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from './test/mongoSetup';

describe('Module 5 — Questionnaire, recommend, compare, favorites', () => {
  let testMongoUri = '';
  let app: ReturnType<typeof createApp>;
  let authToken = '';

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
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'seeker@clearclever.com', password: SEED_DEFAULT_PASSWORD });
    authToken = login.body.data.token;
  });

  const homeAnswers = {
    property_type: 'Apartment',
    occupancy: 'Owner occupied',
    property_value_pkr: 5000000,
    contents_cover: 'Yes — full contents',
    city: 'Karachi',
  };

  async function getApprovedHomePolicyIds(limit = 4): Promise<string[]> {
    const policies = await Policy.find({ category: 'home', status: 'approved' })
      .sort({ premiumMonthlyPkr: 1 })
      .limit(limit);
    return policies.map((policy) => String(policy._id));
  }

  describe('GET /api/questions/:category', () => {
    it('returns category template merged with approved policy questions', async () => {
      const res = await request(app).get('/api/questions/home');

      expect(res.status).toBe(200);
      expect(res.body.data.available).toBe(true);
      expect(res.body.data.questions.length).toBeGreaterThanOrEqual(2);
      expect(res.body.data.questions.some((q: { id: string }) => q.id === 'property_type')).toBe(
        true
      );
    });

    it('returns unavailable state for others', async () => {
      const res = await request(app).get('/api/questions/others');

      expect(res.status).toBe(200);
      expect(res.body.data.available).toBe(false);
      expect(res.body.data.questions).toEqual([]);
    });
  });

  describe('POST /api/recommend', () => {
    it('returns approved policies sorted by score descending', async () => {
      const res = await request(app)
        .post('/api/recommend')
        .send({ category: 'home', answers: homeAnswers });

      expect(res.status).toBe(200);
      expect(res.body.data.available).toBe(true);
      expect(res.body.data.recommendations.length).toBe(3);

      const scores = res.body.data.recommendations.map((item: { score: number }) => item.score);
      expect(scores).toEqual([...scores].sort((a, b) => b - a));

      const slugs = res.body.data.recommendations.map(
        (item: { policy: { slug: string } }) => item.policy.slug
      );
      expect(slugs).not.toContain('tpl-home-premium');
    });

    it('excludes pending policies from recommendations', async () => {
      const res = await request(app)
        .post('/api/recommend')
        .send({ category: 'home', answers: homeAnswers });

      const slugs = res.body.data.recommendations.map((item: { policy: { slug: string } }) => item.policy.slug);
      const pending = await Policy.findOne({ slug: 'tpl-home-premium' });
      expect(pending?.status).toBe('pending');
      expect(slugs).not.toContain('tpl-home-premium');
    });

    it('returns empty recommendations for others', async () => {
      const res = await request(app)
        .post('/api/recommend')
        .send({ category: 'others', answers: { note: 'future category' } });

      expect(res.status).toBe(200);
      expect(res.body.data.available).toBe(false);
      expect(res.body.data.recommendations).toEqual([]);
    });

    it('returns 400 when answers are empty', async () => {
      const res = await request(app)
        .post('/api/recommend')
        .send({ category: 'home', answers: {} });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors.some((e: string) => e.includes('answers'))).toBe(true);
    });

    it('ranks lower premium policies higher when coverage fit is similar', async () => {
      const res = await request(app)
        .post('/api/recommend')
        .send({ category: 'home', answers: homeAnswers });

      const top = res.body.data.recommendations[0];
      expect(top.policy.slug).toBe('tpl-home-essential');
      expect(top.policy.premiumMonthlyPkr).toBe(3500);
    });

    it('stores authenticated questionnaire answers for reuse', async () => {
      const recommend = await request(app)
        .post('/api/recommend')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ category: 'home', answers: homeAnswers });

      expect(recommend.status).toBe(200);

      const stored = await request(app)
        .get('/api/recommend/answers/home')
        .set('Authorization', `Bearer ${authToken}`);

      expect(stored.status).toBe(200);
      expect(stored.body.data.response.answers.city).toBe('Karachi');
      expect(stored.body.data.response.completedQuestionIds).toContain('property_type');
    });

    it('creates inquiry leads for recommended policies when authenticated', async () => {
      await request(app)
        .post('/api/recommend')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ category: 'home', answers: homeAnswers });

      const inquiryLeads = await Lead.find({ type: 'inquiry' });
      expect(inquiryLeads.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('POST /api/compare', () => {
    it('returns 400 when comparing more than 4 policies', async () => {
      const ids = await Policy.find({ status: 'approved' }).limit(5);
      expect(ids.length).toBe(5);

      const res = await request(app)
        .post('/api/compare')
        .send({ policyIds: ids.map((policy) => String(policy._id)) });

      expect(res.status).toBe(400);
      expect(res.body.errors.some((e: string) => e.includes('4 policies'))).toBe(true);
    });

    it('returns 400 when a policy is pending or missing', async () => {
      const approvedIds = await getApprovedHomePolicyIds(2);
      const pending = await Policy.findOne({ slug: 'tpl-home-premium' });
      expect(pending).not.toBeNull();

      const res = await request(app)
        .post('/api/compare')
        .send({ policyIds: [...approvedIds, String(pending!._id)] });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/approved/i);
    });

    it('compares up to 4 approved policies', async () => {
      const ids = await getApprovedHomePolicyIds(3);
      const res = await request(app).post('/api/compare').send({ policyIds: ids });

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(3);
      expect(res.body.data.policies).toHaveLength(3);
    });
  });

  describe('GET /api/policies/:id', () => {
    it('returns an approved policy with insurer summary', async () => {
      const policy = await Policy.findOne({ slug: 'tpl-home-essential' });
      const res = await request(app).get(`/api/policies/${policy!._id}`);

      expect(res.status).toBe(200);
      expect(res.body.data.policy.slug).toBe('tpl-home-essential');
      expect(res.body.data.policy.insurer.slug).toBe('tpl-insurance');
    });

    it('returns 404 for pending policies', async () => {
      const pending = await Policy.findOne({ slug: 'tpl-home-premium' });
      const res = await request(app).get(`/api/policies/${pending!._id}`);

      expect(res.status).toBe(404);
    });
  });

  describe('Favorites CRUD', () => {
    it('requires authentication', async () => {
      const res = await request(app).get('/api/favorites');
      expect(res.status).toBe(401);
    });

    it('creates, lists, and removes favorites for authenticated users', async () => {
      const policy = await Policy.findOne({ slug: 'tpl-home-essential' });

      const createRes = await request(app)
        .post('/api/favorites')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ policyId: String(policy!._id) });

      expect(createRes.status).toBe(201);
      expect(createRes.body.data.policy.slug).toBe('tpl-home-essential');

      const favoriteLead = await Lead.findOne({
        type: 'favorite',
        policyId: policy!._id,
      });
      expect(favoriteLead).toBeTruthy();

      const listRes = await request(app)
        .get('/api/favorites')
        .set('Authorization', `Bearer ${authToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.count).toBe(1);
      expect(listRes.body.data.favorites[0].policy.slug).toBe('tpl-home-essential');

      const deleteRes = await request(app)
        .delete(`/api/favorites/${policy!._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(deleteRes.status).toBe(200);
      expect(await Favorite.countDocuments()).toBe(0);
    });
  });
});
