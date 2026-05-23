import request from 'supertest';
import { createApp } from './app';
import { loadEnv, resetEnvCache } from './config/env';
import { CallSchedule } from './models/CallSchedule';
import { EmailLog } from './models/EmailLog';
import { Lead } from './models/Lead';
import { Notification } from './models/Notification';
import { Policy } from './models/Policy';
import { Purchase } from './models/Purchase';
import { SEED_DEFAULT_PASSWORD } from './seed/userSeedData';
import { seedAll } from './seed/seedCatalog';
import { applyTestEnv } from './test/setupEnv';
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from './test/mongoSetup';

describe('Module 7 — Purchase, affiliate & post-purchase artifacts', () => {
  let testMongoUri = '';
  let app: ReturnType<typeof createApp>;
  let seekerToken = '';

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
    seekerToken = login.body.data.token;
  });

  async function startPurchase() {
    const policy = await Policy.findOne({ slug: 'tpl-home-essential', status: 'approved' });
    expect(policy).toBeTruthy();

    const createRes = await request(app)
      .post('/api/purchase')
      .set('Authorization', `Bearer ${seekerToken}`)
      .send({
        policyId: String(policy!._id),
        answers: {
          property_type: 'Apartment',
          occupancy: 'Owner occupied',
          property_value_pkr: 5000000,
          contents_cover: 'Yes — full contents',
          city: 'Karachi',
        },
      });

    expect(createRes.status).toBe(201);
    return {
      purchaseId: createRes.body.data.purchaseId as string,
      redirectUrl: createRes.body.data.redirectUrl as string,
      token: seekerToken,
    };
  }

  describe('POST /api/purchase', () => {
    it('returns an absolute affiliate redirect URL', async () => {
      const { redirectUrl } = await startPurchase();
      expect(redirectUrl).toContain('/affiliate/tpl-insurance');
      expect(redirectUrl).toContain('purchaseId=');
      expect(redirectUrl).toContain('token=');
    });

    it('requires authentication', async () => {
      const policy = await Policy.findOne({ slug: 'tpl-home-essential' });
      const res = await request(app)
        .post('/api/purchase')
        .send({ policyId: String(policy!._id) });

      expect(res.status).toBe(401);
    });
  });

  describe('Affiliate page', () => {
    it('renders HTML wizard for a valid purchase', async () => {
      const { purchaseId, token } = await startPurchase();

      const res = await request(app)
        .get('/affiliate/tpl-insurance')
        .query({ purchaseId, token });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/html/);
      expect(res.text).toContain('Step 1 — Review your policy');
      expect(res.text).toContain('TPL Home Essential');
    });
  });

  describe('Purchase completion flow', () => {
    it('returns 400 when completing before payment is processed', async () => {
      const { purchaseId } = await startPurchase();

      const res = await request(app)
        .get('/api/purchase/complete')
        .query({ purchaseId, token: seekerToken })
        .set('Accept', 'application/json');

      expect(res.status).toBe(400);
    });

    it('creates notifications, email log, call schedule, and lead after payment + complete', async () => {
      const { purchaseId } = await startPurchase();

      const payRes = await request(app)
        .post(`/api/purchase/${purchaseId}/process-payment`)
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({
          cardholderName: 'Ali Khan',
          cardLast4: '4242',
          cardExpiry: '12/28',
        });

      expect(payRes.status).toBe(200);

      const completeRes = await request(app)
        .get('/api/purchase/complete')
        .query({ purchaseId, token: seekerToken })
        .set('Accept', 'application/json');

      expect(completeRes.status).toBe(200);
      expect(completeRes.body.data.notificationsCreated).toBe(3);

      const purchase = await Purchase.findById(purchaseId);
      const notificationCount = await Notification.countDocuments({
        'metadata.purchaseId': purchaseId,
      });
      expect(notificationCount).toBe(3);

      const emailLog = await EmailLog.findOne({ purchaseId });
      expect(emailLog?.status).toBe('sent');

      const callSchedule = await CallSchedule.findOne({ purchaseId });
      expect(callSchedule?.status).toBe('scheduled');

      const lead = await Lead.findOne({ type: 'purchase', policyId: purchase!.policyId });
      expect(lead).toBeTruthy();
    });

    it('does not duplicate notifications on second complete call', async () => {
      const { purchaseId } = await startPurchase();

      await request(app)
        .post(`/api/purchase/${purchaseId}/process-payment`)
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({
          cardholderName: 'Ali Khan',
          cardLast4: '4242',
          cardExpiry: '12/28',
        });

      await request(app)
        .get('/api/purchase/complete')
        .query({ purchaseId, token: seekerToken })
        .set('Accept', 'application/json');

      const second = await request(app)
        .get('/api/purchase/complete')
        .query({ purchaseId, token: seekerToken })
        .set('Accept', 'application/json');

      expect(second.status).toBe(200);
      expect(second.body.data.alreadyCompleted).toBe(true);

      const notificationCount = await Notification.countDocuments({
        'metadata.purchaseId': purchaseId,
      });
      expect(notificationCount).toBe(3);
    });
  });

  describe('GET /api/purchases and notifications', () => {
    it('lists purchases with timeline after completion', async () => {
      const { purchaseId } = await startPurchase();

      await request(app)
        .post(`/api/purchase/${purchaseId}/process-payment`)
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({
          cardholderName: 'Ali Khan',
          cardLast4: '4242',
          cardExpiry: '12/28',
        });

      await request(app)
        .get('/api/purchase/complete')
        .query({ purchaseId, token: seekerToken })
        .set('Accept', 'application/json');

      const listRes = await request(app)
        .get('/api/purchases')
        .set('Authorization', `Bearer ${seekerToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.purchases[0].timeline.paymentProcessed).toBe(true);
      expect(listRes.body.data.purchases[0].timeline.completed).toBe(true);
      expect(listRes.body.data.purchases[0].timeline.notifications.length).toBe(3);
    });

    it('marks a notification as read', async () => {
      const { purchaseId } = await startPurchase();

      await request(app)
        .post(`/api/purchase/${purchaseId}/process-payment`)
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({
          cardholderName: 'Ali Khan',
          cardLast4: '4242',
          cardExpiry: '12/28',
        });

      await request(app)
        .get('/api/purchase/complete')
        .query({ purchaseId, token: seekerToken })
        .set('Accept', 'application/json');

      const notificationsRes = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${seekerToken}`);

      const notificationId = notificationsRes.body.data.notifications[0].id;

      const readRes = await request(app)
        .patch(`/api/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${seekerToken}`);

      expect(readRes.status).toBe(200);
      expect(readRes.body.data.notification.read).toBe(true);
    });
  });
});
