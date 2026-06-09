import request from 'supertest';
import { createApp } from './app';
import { loadEnv, resetEnvCache } from './config/env';
import { Policy } from './models/Policy';
import { buildPolicyRankerFeatures } from './ml/recommendationFeatureBuilder';
import { scorePolicyMatchProbability } from './ml/policyRankerModel';
import {
  HYBRID_RULE_WEIGHT,
  scorePoliciesHybrid,
} from './services/hybridRecommendationService';
import { seedAll } from './seed/seedCatalog';
import { applyTestEnv } from './test/setupEnv';
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from './test/mongoSetup';
import { enrichPolicies } from './services/policyPresentation';
import { getCategoryQuestions } from './services/questionsService';

const homeAnswers = {
  property_type: 'Apartment',
  occupancy: 'Owner occupied',
  property_value_pkr: 5_000_000,
  contents_cover: 'Yes — full contents',
  city: 'Karachi',
};

describe('Hybrid policy recommender (Module 4)', () => {
  let testMongoUri = '';
  let app: ReturnType<typeof createApp>;

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
  });

  it('scores policy match probabilities for fixed home features', () => {
    const policy = {
      premiumMonthlyPkr: 3500,
      premiumYearlyPkr: 39900,
      features: ['a', 'b', 'c', 'd', 'e'],
      deductiblePkr: 25000,
    } as Parameters<typeof buildPolicyRankerFeatures>[2];

    const features = buildPolicyRankerFeatures('home', homeAnswers, policy);
    const probability = scorePolicyMatchProbability('home', features);

    expect(probability).not.toBeNull();
    expect(probability!).toBeGreaterThan(0);
    expect(probability!).toBeLessThan(1);
  });

  it('returns hybrid ranking metadata on recommend API', async () => {
    const res = await request(app)
      .post('/api/recommend')
      .send({ category: 'home', answers: homeAnswers });

    expect(res.status).toBe(200);
    expect(res.body.data.rankingMethod).toBe('hybrid');
    expect(res.body.data.recommendations.length).toBeGreaterThan(0);

    const top = res.body.data.recommendations[0];
    expect(top.rankingMethod).toBe('hybrid');
    expect(top.ruleScore).toBeGreaterThan(0);
    expect(top.mlConfidence).toBeGreaterThan(0);
    expect(top.mlRank).toBe(1);
    expect(top.score).toBeGreaterThanOrEqual(
      Math.round(HYBRID_RULE_WEIGHT * top.ruleScore)
    );
    expect(top.score).toBeLessThanOrEqual(100);

    const scores = res.body.data.recommendations.map((item: { score: number }) => item.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('keeps tpl-home-essential as top home match for standard seeker answers', async () => {
    const res = await request(app)
      .post('/api/recommend')
      .send({ category: 'home', answers: homeAnswers });

    const top = res.body.data.recommendations[0];
    expect(top.policy.slug).toBe('tpl-home-essential');
    expect(top.policy.premiumMonthlyPkr).toBe(3500);
  });

  it('produces stable hybrid ordering for seeded policies', async () => {
    const questionSet = await getCategoryQuestions('home');
    const approvedPolicies = await Policy.find({ category: 'home', status: 'approved' });
    const publicPolicies = await enrichPolicies(approvedPolicies);

    const first = scorePoliciesHybrid(
      'home',
      approvedPolicies,
      publicPolicies,
      questionSet.questions,
      homeAnswers
    );
    const second = scorePoliciesHybrid(
      'home',
      approvedPolicies,
      publicPolicies,
      questionSet.questions,
      homeAnswers
    );

    expect(first.map((row) => row.policy.id)).toEqual(second.map((row) => row.policy.id));
  });
});
