import request from 'supertest';
import { createApp } from './app';
import { loadEnv, resetEnvCache } from './config/env';
import { CallSchedule } from './models/CallSchedule';
import { ClaimRequest } from './models/ClaimRequest';
import { Conversation } from './models/Conversation';
import { EmailLog } from './models/EmailLog';
import { InsurerProfile } from './models/InsurerProfile';
import { Lead } from './models/Lead';
import { Message } from './models/Message';
import { Notification } from './models/Notification';
import { Policy } from './models/Policy';
import { User } from './models/User';
import { Purchase } from './models/Purchase';
import { QuestionnaireResponse } from './models/QuestionnaireResponse';
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

  function futurePktDateTime() {
    const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const pkt = new Date(future.getTime() + 5 * 60 * 60 * 1000);
    const date = pkt.toISOString().slice(0, 10);
    return { scheduledDate: date, scheduledTime: '14:30' };
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

    it('persists questionnaire answers for dashboard reuse', async () => {
      await startPurchase();

      const stored = await QuestionnaireResponse.findOne({
        userId: (await User.findOne({ email: 'seeker@clearclever.com' }))!._id,
        category: 'home',
      });

      expect(stored).toBeTruthy();
      expect(stored!.answers.city).toBe('Karachi');
      expect(stored!.answers.property_type).toBe('Apartment');
    });

    it('rejects pending policies', async () => {
      const pending = await Policy.findOne({ slug: 'tpl-home-premium' });
      expect(pending?.status).toBe('pending');

      const res = await request(app)
        .post('/api/purchase')
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({ policyId: String(pending!._id), answers: { city: 'Karachi' } });

      expect(res.status).toBe(404);
    });

    it('requires CNIC when user has none on file', async () => {
      const seeker = await User.findOne({ email: 'seeker@clearclever.com' });
      seeker!.cnic = undefined;
      await seeker!.save();

      const policy = await Policy.findOne({ slug: 'tpl-home-essential', status: 'approved' });

      const res = await request(app)
        .post('/api/purchase')
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({
          policyId: String(policy!._id),
          answers: { city: 'Karachi' },
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/CNIC is required/i);
    });

    it('assigns CNIC from contact_cnic and starts checkout', async () => {
      const seeker = await User.findOne({ email: 'seeker@clearclever.com' });
      seeker!.cnic = undefined;
      await seeker!.save();

      const policy = await Policy.findOne({ slug: 'tpl-home-essential', status: 'approved' });

      const res = await request(app)
        .post('/api/purchase')
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({
          policyId: String(policy!._id),
          answers: {
            property_type: 'Apartment',
            city: 'Karachi',
            contact_cnic: '42101-1234567-1',
            contact_full_name: 'Ali Khan',
            contact_email: 'seeker@clearclever.com',
            contact_phone: '+923001234567',
            contact_address: '123 Main St',
            contact_city: 'Karachi',
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.data.redirectUrl).toContain('/affiliate/tpl-insurance');

      const updated = await User.findOne({ email: 'seeker@clearclever.com' });
      expect(updated?.cnic).toBe('42101-1234567-1');
    });
  });

  describe('Affiliate page', () => {
    it('renders step 1 review page for a valid purchase', async () => {
      const { purchaseId, token } = await startPurchase();

      const res = await request(app)
        .get('/affiliate/tpl-insurance')
        .query({ purchaseId, token, step: '1' });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/html/);
      expect(res.text).toContain('Step 1 — Review your policy');
      expect(res.text).toContain('TPL Home Essential');
      expect(res.text).toContain('ClearClever');
      expect(res.text).toContain('TPL Insurance');
      expect(res.text).toContain('Secure partner checkout');
      expect(res.text).not.toContain('Step 2 — Simulate payment');
    });

    it('renders payment step and TPL website URL on step 3', async () => {
      const { purchaseId, token } = await startPurchase();

      const step2 = await request(app)
        .get('/affiliate/tpl-insurance')
        .query({ purchaseId, token, step: '2' });
      expect(step2.text).toContain('Step 2 — Simulate payment');

      await request(app)
        .post(`/api/purchase/${purchaseId}/process-payment`)
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({
          cardholderName: 'Ali Khan',
          cardLast4: '4242',
          cardExpiry: '12/28',
        });

      const step3 = await request(app)
        .get('/affiliate/tpl-insurance')
        .query({ purchaseId, token, step: '3' });
      expect(step3.text).toContain('https://tplinsurance.com/');
    });

    it('allows updating answers on a pending purchase', async () => {
      const { purchaseId } = await startPurchase();

      const res = await request(app)
        .patch(`/api/purchase/${purchaseId}/answers`)
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({
          answers: {
            property_type: 'House',
            city: 'Lahore',
          },
        });

      expect(res.status).toBe(200);
      const purchase = await Purchase.findById(purchaseId);
      expect(purchase?.answers.property_type).toBe('House');
      expect(purchase?.answers.city).toBe('Lahore');
    });

    it('creates a checkout inquiry lead when purchase starts', async () => {
      const { purchaseId } = await startPurchase();
      const lead = await Lead.findOne({ type: 'inquiry', 'metadata.purchaseId': purchaseId });
      expect(lead).toBeTruthy();
    });
  });

  describe('Purchase completion flow', () => {
    it('rejects expired card expiry dates', async () => {
      const { purchaseId } = await startPurchase();

      const res = await request(app)
        .post(`/api/purchase/${purchaseId}/process-payment`)
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({
          cardholderName: 'Ali Khan',
          cardLast4: '4242',
          cardExpiry: '11/19',
        });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain('cardExpiry: Enter a valid active card expiry date');
    });

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
      expect(completeRes.body.data.notificationsCreated).toBe(4);

      const purchase = await Purchase.findById(purchaseId);
      const notificationCount = await Notification.countDocuments({
        'metadata.purchaseId': purchaseId,
      });
      expect(notificationCount).toBe(4);

      const insurerProfile = await InsurerProfile.findById(purchase!.insurerProfileId);
      const insurerUser = await User.findById(insurerProfile!.userId);
      const insurerNotification = await Notification.findOne({
        userId: insurerUser!._id,
        type: 'new_lead',
      });
      expect(insurerNotification).toBeTruthy();

      const conversation = await Conversation.findOne({ purchaseId });
      expect(conversation?.type).toBe('user_insurer');
      const message = await Message.findOne({ conversationId: conversation!._id });
      expect(message?.body).toContain('Thank you for purchasing');

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
      expect(notificationCount).toBe(4);
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
      expect(listRes.body.data.purchases[0].timeline.email?.body).toContain('Thank you for choosing');
      expect(listRes.body.data.purchases[0].policy.features.length).toBeGreaterThan(0);
      expect(listRes.body.data.purchases[0].policy.documentSummary.policyNumber).toMatch(/^CC-/);
    });

    it('reschedules an agent call for a completed purchase', async () => {
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

      const res = await request(app)
        .patch(`/api/purchases/${purchaseId}/call-schedule`)
        .set('Authorization', `Bearer ${seekerToken}`)
        .send(futurePktDateTime());

      expect(res.status).toBe(200);
      expect(res.body.data.purchase.timeline.callScheduled.agentLabel).toBe('ClearClever agent');

      const schedule = await CallSchedule.findOne({ purchaseId });
      expect(schedule?.notes).toBe('Rescheduled by policy seeker');

      const notification = await Notification.findOne({ type: 'call_rescheduled' });
      expect(notification?.metadata?.purchaseId).toBe(purchaseId);
    });

    it('creates claims only for completed purchases', async () => {
      const { purchaseId } = await startPurchase();

      const blocked = await request(app)
        .post('/api/claims')
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({
          purchaseId,
          claimType: 'damage',
          incidentDate: new Date().toISOString(),
          estimatedAmountPkr: 100000,
          description: 'Water damage after heavy rainfall.',
        });
      expect(blocked.status).toBe(400);

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

      const created = await request(app)
        .post('/api/claims')
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({
          purchaseId,
          claimType: 'damage',
          incidentDate: new Date().toISOString(),
          estimatedAmountPkr: 100000,
          description: 'Water damage after heavy rainfall.',
        });

      expect(created.status).toBe(201);
      expect(created.body.data.claim.status).toBe('submitted');

      const stored = await ClaimRequest.findById(created.body.data.claim.id);
      expect(stored?.purchaseId.toString()).toBe(purchaseId);

      const list = await request(app)
        .get('/api/claims')
        .set('Authorization', `Bearer ${seekerToken}`);
      expect(list.body.data.claims).toHaveLength(1);
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

    it('marks all notifications read and clears them for the current user', async () => {
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

      const before = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${seekerToken}`);
      expect(before.body.data.unreadCount).toBe(3);
      expect(before.body.data.notifications[0].target.path).toBe('/dashboard/purchases');

      const readAll = await request(app)
        .patch('/api/notifications/read-all')
        .set('Authorization', `Bearer ${seekerToken}`);
      expect(readAll.status).toBe(200);
      expect(readAll.body.data.modifiedCount).toBe(3);

      const afterRead = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${seekerToken}`);
      expect(afterRead.body.data.unreadCount).toBe(0);

      const clear = await request(app)
        .delete('/api/notifications/clear')
        .set('Authorization', `Bearer ${seekerToken}`);
      expect(clear.status).toBe(200);
      expect(clear.body.data.deletedCount).toBe(3);

      const afterClear = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${seekerToken}`);
      expect(afterClear.body.data.count).toBe(0);
    });
  });
});
