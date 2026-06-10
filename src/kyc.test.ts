import request from 'supertest';
import { createApp } from './app';
import { loadEnv, resetEnvCache } from './config/env';
import { KycVerification } from './models/KycVerification';
import { User } from './models/User';
import { SEED_DEFAULT_PASSWORD } from './seed/userSeedData';
import { seedAll } from './seed/seedCatalog';
import { applyTestEnv } from './test/setupEnv';
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from './test/mongoSetup';
import { computeIdentityMatchScore } from './services/identityVerificationService';

describe('KYC API', () => {
  let testMongoUri = '';
  let app: ReturnType<typeof createApp>;
  let token = '';

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
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'seeker@clearclever.com', password: SEED_DEFAULT_PASSWORD });
    token = res.body.data.token;
  });

  it('returns verified status for seeded seeker with completed KYC upload', async () => {
    const res = await request(app)
      .get('/api/kyc/status')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.kyc.status).toBe('verified');
    expect(res.body.data.kyc.district).toBe('Karachi');
  });

  it('returns none status for accounts without CNIC or KYC', async () => {
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@clearclever.com', password: SEED_DEFAULT_PASSWORD });

    const res = await request(app)
      .get('/api/kyc/status')
      .set('Authorization', `Bearer ${adminLogin.body.data.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.kyc.status).toBe('none');
  });

  it('derives local demographics from CNIC without marking KYC under review', async () => {
    const res = await request(app)
      .post('/api/kyc/derive')
      .set('Authorization', `Bearer ${token}`)
      .send({ cnic: '42101-1234567-2' });

    expect(res.status).toBe(200);
    expect(res.body.data.kyc.status).toBe('none');
    expect(res.body.data.kyc.genderPredicted).toBe('female');
    expect(res.body.data.kyc.district).toBe('Karachi');

    const seeker = await User.findOne({ email: 'seeker@clearclever.com' });
    const record = await KycVerification.findOne({ userId: seeker?._id });
    expect(record?.district).toBe('Karachi');
    expect(record?.status).toBe('none');
  });

  it('includes kyc fields in auth me payload after derive', async () => {
    await request(app)
      .post('/api/kyc/derive')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(me.status).toBe(200);
    expect(me.body.data.user.kycSummary?.district).toBe('Karachi');
  });

  it('rejects verify without Gemini configured', async () => {
    const failedLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bilal.ahmed@clearclever.com', password: SEED_DEFAULT_PASSWORD });
    const failedToken = failedLogin.body.data.token;

    const res = await request(app)
      .post('/api/kyc/verify')
      .set('Authorization', `Bearer ${failedToken}`)
      .send({
        attachment: {
          mimeType: 'image/jpeg',
          fileName: 'cnic.jpg',
          dataBase64: Buffer.from('fake').toString('base64'),
        },
      });

    expect(res.status).toBe(503);
  });

  it('auto-derives regional metadata when CNIC assigned via profile update', async () => {
    const seeker = await User.findOne({ email: 'seeker@clearclever.com' });
    await request(app)
      .patch('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ cnic: '35202-1111111-1' });

    const kyc = await KycVerification.findOne({ userId: seeker?._id });
    expect(kyc?.district).toBe('Lahore');
    expect(kyc?.status).toBe('none');
  });

  it('blocks verify resubmission when KYC is already verified', async () => {
    const res = await request(app)
      .post('/api/kyc/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({
        attachment: {
          mimeType: 'image/jpeg',
          fileName: 'cnic.jpg',
          dataBase64: Buffer.from('fake').toString('base64'),
        },
      });

    expect(res.status).toBe(409);
  });
});

describe('identity match scoring', () => {
  it('scores high when name and CNIC match', () => {
    const result = computeIdentityMatchScore({
      profileName: 'Ayesha Khan',
      profileCnic: '42101-1234567-2',
      extractedName: 'Ayesha Khan',
      extractedCnic: '42101-1234567-2',
      documentReadable: true,
      cnicExpired: false,
      suspiciousDocument: false,
      croppedDocument: false,
      blurScore: 'Low',
    });
    expect(result.kycScore).toBeGreaterThanOrEqual(85);
    expect(result.identityVerified).toBe(true);
  });
});
