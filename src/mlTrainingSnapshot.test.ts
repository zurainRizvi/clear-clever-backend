import request from 'supertest';
import { createApp } from './app';
import { loadEnv, resetEnvCache } from './config/env';
import { hashPassword } from './services/auth';
import { ClaimRequest } from './models/ClaimRequest';
import { InsurerProfile } from './models/InsurerProfile';
import { MlTrainingSnapshot } from './models/MlTrainingSnapshot';
import { Policy } from './models/Policy';
import { Purchase } from './models/Purchase';
import { User } from './models/User';
import { MlPredictionLog } from './models/MlPredictionLog';
import { SEED_DEFAULT_PASSWORD } from './seed/userSeedData';
import { seedAll } from './seed/seedCatalog';
import { seedDemo } from './seed/seedDemo';
import { applyTestEnv } from './test/setupEnv';
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from './test/mongoSetup';

describe('ML training snapshots', () => {
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

  it('captures claim risk snapshot and prediction log for non-demo users on approval', async () => {
    const tplProfile = await InsurerProfile.findOne({ slug: 'tpl-insurance' });
    const policy = await Policy.findOne({ insurerProfileId: tplProfile!._id });
    const productionUser = await User.create({
      fullName: 'Production Seeker',
      email: 'production.seeker@example.com',
      phone: '+923001234567',
      passwordHash: await hashPassword('password12'),
      role: 'user',
      status: 'active',
    });
    const purchase = await Purchase.create({
      userId: productionUser._id,
      policyId: policy!._id,
      insurerProfileId: tplProfile!._id,
      affiliateSlug: 'direct',
      status: 'completed',
      answers: { city: 'Lahore' },
      paymentProcessedAt: new Date(),
      completionArtifactsCreated: true,
    });
    const claim = await ClaimRequest.create({
      userId: productionUser._id,
      purchaseId: purchase._id,
      policyId: policy!._id,
      insurerProfileId: tplProfile!._id,
      claimType: 'damage',
      incidentDate: new Date(),
      estimatedAmountPkr: 75000,
      description: 'Production claim for ML snapshot capture.',
      status: 'submitted',
    });

    const res = await request(app)
      .patch(`/api/insurer/claims/${claim._id}`)
      .set('Authorization', `Bearer ${tplToken}`)
      .send({ status: 'approved' });

    expect(res.status).toBe(200);

    const snapshot = await MlTrainingSnapshot.findOne({
      domain: 'claim_risk',
      referenceKey: String(claim._id),
    });
    expect(snapshot).not.toBeNull();
    expect(snapshot!.label).toBe(0);
    expect(snapshot!.features).toMatchObject({
      claim_type: 'damage',
      estimated_amount_pkr: 75000,
    });

    const log = await MlPredictionLog.findOne({ referenceId: String(claim._id) });
    expect(log).not.toBeNull();
    expect(log!.actualOutcome).toBe('approved');
    expect(log!.predictedScore).toBeGreaterThanOrEqual(0);
  });

  it('skips demo seed users when capturing claim risk snapshots', async () => {
    const seeker = await User.findOne({ email: 'seeker@clearclever.com' });
    const demoClaim = await ClaimRequest.findOne({ userId: seeker!._id });

    const res = await request(app)
      .patch(`/api/insurer/claims/${demoClaim!._id}`)
      .set('Authorization', `Bearer ${tplToken}`)
      .send({ status: 'rejected' });

    expect(res.status).toBe(200);

    const snapshot = await MlTrainingSnapshot.findOne({
      domain: 'claim_risk',
      referenceKey: String(demoClaim!._id),
    });
    expect(snapshot).toBeNull();
  });

  it('records fraud resolution snapshots for superadmin', async () => {
    const superToken = await login('superadmin@clearclever.com');
    const listRes = await request(app)
      .get('/api/admin/fraud-signals?category=account')
      .set('Authorization', `Bearer ${superToken}`);

    expect(listRes.status).toBe(200);
    const signal = listRes.body.data.signals[0];
    expect(signal).toBeDefined();

    const resolveRes = await request(app)
      .post(`/api/admin/fraud-signals/account/resolve`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        signalId: signal.id,
        resolution: 'false_positive',
      });

    expect(resolveRes.status).toBe(200);

    const snapshot = await MlTrainingSnapshot.findOne({
      domain: 'fraud',
      referenceKey: `account:${signal.id}`,
    });
    expect(snapshot).not.toBeNull();
    expect(snapshot!.label).toBe(0);
  });
});
