import request from 'supertest';
import { createApp } from './app';
import { loadEnv, resetEnvCache } from './config/env';
import { buildFraudMlFeatures } from './ml/fraudFeatureBuilder';
import { scoreFraudFromFeatures } from './ml/fraudModel';
import type { FraudMlRawFeatures } from './ml/types';
import { SEED_DEFAULT_PASSWORD } from './seed/userSeedData';
import { seedAll } from './seed/seedCatalog';
import { seedDemo } from './seed/seedDemo';
import { applyTestEnv } from './test/setupEnv';
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from './test/mongoSetup';

const lowRiskFeatures: FraudMlRawFeatures = {
  signal_type: 'stale_pending_policies',
  fraud_category: 'catalog',
  severity_encoded: 1,
  account_age_days: 400,
  related_entity_count: 2,
};

const highRiskFeatures: FraudMlRawFeatures = {
  signal_type: 'duplicate_email',
  fraud_category: 'account',
  severity_encoded: 4,
  account_age_days: 14,
  related_entity_count: 18,
};

describe('Fraud ML', () => {
  let testMongoUri = '';
  let app: ReturnType<typeof createApp>;
  let adminToken = '';

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
    await seedDemo();
    app = createApp(loadEnv());
    adminToken = await login('admin@clearclever.com');
  });

  it('scores fixed fraud feature vectors with stable structure', () => {
    const low = scoreFraudFromFeatures(lowRiskFeatures);
    const high = scoreFraudFromFeatures(highRiskFeatures);

    expect(low).not.toBeNull();
    expect(high).not.toBeNull();
    expect(low!.mlModelVersion).toBe('fraud_v1');
    expect(low!.mlScore).toBeGreaterThanOrEqual(0);
    expect(low!.mlScore).toBeLessThanOrEqual(100);
    expect(low!.mlFactors.length).toBeGreaterThan(0);
    expect(high!.mlScore).toBeGreaterThanOrEqual(low!.mlScore);
  });

  it('maps heuristic signals to ML features consistently', () => {
    const features = buildFraudMlFeatures(
      {
        id: 'claim-freq-abc',
        type: 'Unusual claim frequency',
        severity: 'high',
        subject: 'seeker@clearclever.com',
        detail: '4 claims filed in the last 7 days',
        detectedAt: new Date().toISOString(),
      },
      'claims'
    );

    expect(features.signal_type).toBe('claim_burst');
    expect(features.related_entity_count).toBe(7);
    expect(features.fraud_category).toBe('claims');
  });

  const categories = ['account', 'claims', 'commerce', 'catalog'] as const;

  it.each(categories)('returns mlScore on fraud signals for category=%s', async (category) => {
    const res = await request(app)
      .get(`/api/admin/fraud-signals?category=${category}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.category).toBe(category);
    expect(Array.isArray(res.body.data.signals)).toBe(true);

    if (scoreFraudFromFeatures(lowRiskFeatures)) {
      if (res.body.data.signals.length > 0) {
        const withMl = res.body.data.signals.find(
          (signal: { mlScore?: number }) => typeof signal.mlScore === 'number'
        );
        expect(withMl).toBeDefined();
        expect(withMl.mlFactors).toEqual(expect.any(Array));
        expect(res.body.data.mlSummary).toMatchObject({
          averageScore: expect.any(Number),
          highConfidenceCount: expect.any(Number),
          modelVersion: 'fraud_v1',
        });
      }
    }
  });
});
