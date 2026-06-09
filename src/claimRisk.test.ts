import request from 'supertest';
import { createApp } from './app';
import { loadEnv, resetEnvCache } from './config/env';
import { scoreClaimRiskFromFeatures } from './ml/claimRiskModel';
import type { ClaimRiskRawFeatures } from './ml/types';
import { SEED_DEFAULT_PASSWORD } from './seed/userSeedData';
import { seedAll } from './seed/seedCatalog';
import { seedDemo } from './seed/seedDemo';
import { applyTestEnv } from './test/setupEnv';
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from './test/mongoSetup';

const baselineFeatures: ClaimRiskRawFeatures = {
  claim_type: 'home',
  policy_category: 'home',
  estimated_amount_pkr: 85000,
  description_length: 72,
  days_incident_to_submit: 3,
  amount_to_premium_ratio: 12.5,
  user_claims_7d: 0,
  user_claims_30d: 1,
  user_rejected_claims: 0,
  city_region: 'punjab',
};

const riskyFeatures: ClaimRiskRawFeatures = {
  ...baselineFeatures,
  estimated_amount_pkr: 1_200_000,
  days_incident_to_submit: 40,
  amount_to_premium_ratio: 120,
  user_claims_7d: 4,
  user_claims_30d: 8,
  user_rejected_claims: 2,
};

describe('Claim risk ML', () => {
  let testMongoUri = '';
  let app: ReturnType<typeof createApp>;
  let tplToken = '';

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
    tplToken = await login('insurer.tpl@clearclever.com');
  });

  it('scores fixed feature vectors with stable structure', () => {
    const low = scoreClaimRiskFromFeatures(baselineFeatures);
    const high = scoreClaimRiskFromFeatures(riskyFeatures);

    expect(low).not.toBeNull();
    expect(high).not.toBeNull();
    expect(low!.modelVersion).toBe('claim_risk_v1');
    expect(low!.score).toBeGreaterThanOrEqual(0);
    expect(low!.score).toBeLessThanOrEqual(100);
    expect(['low', 'medium', 'high']).toContain(low!.level);
    expect(low!.topFactors.length).toBeGreaterThan(0);
    expect(high!.score).toBeGreaterThanOrEqual(low!.score);
  });

  it('includes mlRisk on insurer claims list when artifact is present', async () => {
    const res = await request(app)
      .get('/api/insurer/claims')
      .set('Authorization', `Bearer ${tplToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.claims.length).toBeGreaterThan(0);

    const withMl = res.body.data.claims.find((claim: { mlRisk?: unknown }) => claim.mlRisk);
    if (scoreClaimRiskFromFeatures(baselineFeatures)) {
      expect(withMl).toBeDefined();
      expect(withMl.mlRisk).toMatchObject({
        score: expect.any(Number),
        level: expect.stringMatching(/^(low|medium|high)$/),
        approvalProbability: expect.any(Number),
        topFactors: expect.any(Array),
        modelVersion: 'claim_risk_v1',
      });
    }
  });
});
