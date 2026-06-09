import request from 'supertest';
import { createApp } from './app';
import { loadEnv, resetEnvCache } from './config/env';
import { CallSchedule } from './models/CallSchedule';
import { ClaimRequest } from './models/ClaimRequest';
import { EmailLog } from './models/EmailLog';
import { KycVerification } from './models/KycVerification';
import { Lead } from './models/Lead';
import { Purchase } from './models/Purchase';
import { User } from './models/User';
import { SEED_DEFAULT_PASSWORD } from './seed/userSeedData';
import { seedAll } from './seed/seedCatalog';
import { seedDemo } from './seed/seedDemo';
import { applyTestEnv } from './test/setupEnv';
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from './test/mongoSetup';

describe('Demo transactional seed', () => {
  let testMongoUri = '';

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
  });

  it('is idempotent and creates demo activity for seekers', async () => {
    const first = await seedDemo();
    const second = await seedDemo();

    expect(first.purchases).toBeGreaterThan(0);
    expect(first.leads).toBeGreaterThan(0);
    expect(first.claims).toBeGreaterThan(0);
    expect(second.purchases).toBe(first.purchases);
    expect(second.leads).toBe(first.leads);
    expect(second.claims).toBe(first.claims);

    const seeker = await User.findOne({ email: 'seeker@clearclever.com' });
    const completed = await Purchase.countDocuments({
      userId: seeker!._id,
      status: 'completed',
    });
    expect(completed).toBeGreaterThanOrEqual(1);

    const emailLogs = await EmailLog.countDocuments({ userId: seeker!._id });
    expect(emailLogs).toBeGreaterThanOrEqual(1);

    const callSchedules = await CallSchedule.countDocuments({ userId: seeker!._id });
    expect(callSchedules).toBeGreaterThanOrEqual(1);
  });

  it('populates admin analytics after demo seed', async () => {
    await seedDemo();

    const app = createApp(loadEnv());
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@clearclever.com', password: SEED_DEFAULT_PASSWORD });

    const res = await request(app)
      .get('/api/admin/analytics')
      .set('Authorization', `Bearer ${login.body.data.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.leads.total).toBeGreaterThan(0);
    expect(res.body.data.policies.approved).toBeGreaterThan(0);
  });

  it('seeds pending verification insurer for superadmin approvals', async () => {
    const pending = await User.findOne({ email: 'insurer.pending@clearclever.com' });
    expect(pending?.role).toBe('insurer');
    expect(pending?.status).toBe('pendingVerification');
  });

  it('creates claims across multiple statuses', async () => {
    await seedDemo();

    const submitted = await ClaimRequest.countDocuments({ status: 'submitted' });
    const approved = await ClaimRequest.countDocuments({ status: 'approved' });
    const rejected = await ClaimRequest.countDocuments({ status: 'rejected' });

    expect(submitted).toBeGreaterThan(0);
    expect(approved).toBeGreaterThan(0);
    expect(rejected).toBeGreaterThan(0);
  });

  it('distributes leads across insurers', async () => {
    await seedDemo();

    const leadCount = await Lead.countDocuments();
    expect(leadCount).toBeGreaterThanOrEqual(20);
  });

  it('seeds realistic KYC records for all seeker accounts', async () => {
    const demo = await seedDemo();

    expect(demo.kycCreated + demo.kycUpdated).toBeGreaterThanOrEqual(8);

    const verified = await KycVerification.countDocuments({ status: 'verified' });
    const partial = await KycVerification.countDocuments({ status: 'partial' });
    const failed = await KycVerification.countDocuments({ status: 'failed' });

    expect(verified).toBeGreaterThanOrEqual(4);
    expect(partial).toBeGreaterThanOrEqual(2);
    expect(failed).toBeGreaterThanOrEqual(1);

    const seeker = await User.findOne({ email: 'seeker@clearclever.com' });
    const seekerKyc = await KycVerification.findOne({ userId: seeker!._id });
    expect(seekerKyc?.status).toBe('verified');
    expect(seekerKyc?.district).toBe('Karachi');
    expect(seekerKyc?.kycScore).toBeGreaterThanOrEqual(85);
  });

  it('fills insurer analytics customer demographics from purchaser KYC', async () => {
    await seedDemo();

    const app = createApp(loadEnv());
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'insurer.tpl@clearclever.com', password: SEED_DEFAULT_PASSWORD });

    const res = await request(app)
      .get('/api/insurer/analytics')
      .set('Authorization', `Bearer ${login.body.data.token}`);

    expect(res.status).toBe(200);
    const demo = res.body.data.analytics.customerDemographics;
    expect(demo.totalPurchasers).toBeGreaterThan(0);
    expect(demo.gender.male + demo.gender.female).toBeGreaterThan(0);
    expect(demo.topDistricts.length).toBeGreaterThan(0);
    expect(demo.topProvinces.length).toBeGreaterThan(0);
    expect(demo.kycVerifiedCount).toBeGreaterThan(0);
    expect(demo.verificationQuality.avgKycScore).toBeGreaterThan(0);
  });
});
