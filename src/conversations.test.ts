import request from 'supertest';
import { createApp } from './app';
import { loadEnv, resetEnvCache } from './config/env';
import { Conversation } from './models/Conversation';
import { InsurerProfile } from './models/InsurerProfile';
import { Message } from './models/Message';
import { SEED_DEFAULT_PASSWORD } from './seed/userSeedData';
import { seedAll } from './seed/seedCatalog';
import { applyTestEnv } from './test/setupEnv';
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from './test/mongoSetup';

describe('Messaging conversations', () => {
  let testMongoUri = '';
  let app: ReturnType<typeof createApp>;
  let seekerToken = '';
  let tplToken = '';
  let jubileeToken = '';
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

    app = createApp(loadEnv());
    seekerToken = await login('seeker@clearclever.com');
    tplToken = await login('insurer.tpl@clearclever.com');
    jubileeToken = await login('insurer.jubilee@clearclever.com');
    adminToken = await login('admin@clearclever.com');
  });

  it('lets a seeker start an insurer conversation and the insurer reply', async () => {
    const tplProfile = await InsurerProfile.findOne({ slug: 'tpl-insurance' });

    const createRes = await request(app)
      .post('/api/conversations')
      .set('Authorization', `Bearer ${seekerToken}`)
      .send({
        type: 'user_insurer',
        insurerProfileId: String(tplProfile!._id),
        subject: 'Question about TPL cover',
        initialMessage: 'Can you explain the deductible?',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.conversation.type).toBe('user_insurer');
    expect(createRes.body.data.message.body).toBe('Can you explain the deductible?');

    const conversationId = createRes.body.data.conversation.id as string;
    const replyRes = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${tplToken}`)
      .send({ body: 'Yes, the deductible is paid per claim.' });

    expect(replyRes.status).toBe(201);
    expect(replyRes.body.data.message.body).toBe('Yes, the deductible is paid per claim.');

    const listRes = await request(app)
      .get('/api/conversations')
      .set('Authorization', `Bearer ${seekerToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.count).toBe(1);

    expect(await Conversation.countDocuments()).toBe(1);
    expect(await Message.countDocuments()).toBe(2);
  });

  it('blocks non-participants from reading insurer conversations', async () => {
    const tplProfile = await InsurerProfile.findOne({ slug: 'tpl-insurance' });
    const createRes = await request(app)
      .post('/api/conversations')
      .set('Authorization', `Bearer ${seekerToken}`)
      .send({
        type: 'user_insurer',
        insurerProfileId: String(tplProfile!._id),
        initialMessage: 'Hello TPL',
      });

    const res = await request(app)
      .get(`/api/conversations/${createRes.body.data.conversation.id}/messages`)
      .set('Authorization', `Bearer ${jubileeToken}`);

    expect(res.status).toBe(403);
  });

  it('lets staff see support conversations started by users', async () => {
    const createRes = await request(app)
      .post('/api/conversations')
      .set('Authorization', `Bearer ${seekerToken}`)
      .send({
        type: 'user_support',
        subject: 'Need help',
        initialMessage: 'I need help with my purchase.',
      });

    expect(createRes.status).toBe(201);

    const adminList = await request(app)
      .get('/api/conversations')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(adminList.status).toBe(200);
    expect(
      adminList.body.data.conversations.some(
        (conversation: { id: string }) => conversation.id === createRes.body.data.conversation.id
      )
    ).toBe(true);
  });
});
