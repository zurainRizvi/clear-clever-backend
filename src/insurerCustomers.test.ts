import request from 'supertest';
import { createApp } from './app';
import { loadEnv, resetEnvCache } from './config/env';
import { InsurerProfile } from './models/InsurerProfile';
import { Notification } from './models/Notification';
import { Policy } from './models/Policy';
import { Purchase } from './models/Purchase';
import { User } from './models/User';
import { SEED_DEFAULT_PASSWORD } from './seed/userSeedData';
import { seedAll } from './seed/seedCatalog';
import { applyTestEnv } from './test/setupEnv';
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from './test/mongoSetup';

describe('Insurer customer groups and purchase lifecycle', () => {
  let testMongoUri = '';
  let app: ReturnType<typeof createApp>;
  let insurerToken = '';
  let seekerToken = '';
  let purchaseId = '';

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
    insurerToken = await login('insurer.tpl@clearclever.com');
    seekerToken = await login('seeker@clearclever.com');

    const profile = await InsurerProfile.findOne({ slug: 'tpl-insurance' });
    const seeker = await User.findOne({ email: 'seeker@clearclever.com' });
    const policy = await Policy.findOne({
      insurerProfileId: profile!._id,
      status: 'approved',
    });

    const purchase = await Purchase.create({
      userId: seeker!._id,
      policyId: policy!._id,
      insurerProfileId: profile!._id,
      affiliateSlug: profile!.slug,
      answers: {},
      status: 'completed',
      paymentProcessedAt: new Date(),
      completedAt: new Date(),
      completionArtifactsCreated: true,
    });
    purchaseId = String(purchase._id);
  });

  it('groups leads and purchases by customer email', async () => {
    const res = await request(app)
      .get('/api/insurer/leads')
      .set('Authorization', `Bearer ${insurerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.customers).toBeInstanceOf(Array);
    expect(res.body.data.customers.length).toBeGreaterThan(0);
    const customer = res.body.data.customers.find(
      (row: { seeker: { email: string } }) => row.seeker.email === 'seeker@clearclever.com'
    );
    expect(customer).toBeTruthy();
    expect(customer.purchases.length).toBeGreaterThan(0);
  });

  it('revokes a completed purchase and hides it from seeker purchases', async () => {
    const revokeRes = await request(app)
      .patch(`/api/insurer/purchases/${purchaseId}/revoke`)
      .set('Authorization', `Bearer ${insurerToken}`);

    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.data.purchase.status).toBe('revoked');

    const seekerPurchases = await request(app)
      .get('/api/purchases')
      .set('Authorization', `Bearer ${seekerToken}`);

    expect(seekerPurchases.status).toBe(200);
    expect(
      seekerPurchases.body.data.purchases.some(
        (purchase: { id: string }) => purchase.id === purchaseId
      )
    ).toBe(false);

    const notifications = await Notification.find({
      userId: (await User.findOne({ email: 'seeker@clearclever.com' }))!._id,
      type: 'purchase_revoked',
    });
    expect(notifications.length).toBeGreaterThan(0);
  });

  it('terminates a completed purchase and keeps it visible to the seeker', async () => {
    const terminateRes = await request(app)
      .patch(`/api/insurer/purchases/${purchaseId}/terminate`)
      .set('Authorization', `Bearer ${insurerToken}`);

    expect(terminateRes.status).toBe(200);
    expect(terminateRes.body.data.purchase.status).toBe('terminated');

    const seekerPurchases = await request(app)
      .get('/api/purchases')
      .set('Authorization', `Bearer ${seekerToken}`);

    expect(seekerPurchases.status).toBe(200);
    const purchase = seekerPurchases.body.data.purchases.find(
      (row: { id: string }) => row.id === purchaseId
    );
    expect(purchase?.status).toBe('terminated');
  });
});
