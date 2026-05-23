import request from 'supertest';
import { createApp } from './app';
import { loadEnv, resetEnvCache } from './config/env';
import { OtpVerification } from './models/OtpVerification';
import * as mailService from './services/mail';
import { applyTestEnv } from './test/setupEnv';
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from './test/mongoSetup';

jest.mock('./services/mail', () => ({
  sendOtpEmail: jest.fn().mockResolvedValue(undefined),
}));

const sendOtpEmailMock = mailService.sendOtpEmail as jest.Mock;

describe('Module 2 — Authentication & OTP', () => {
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
    sendOtpEmailMock.mockClear();
    applyTestEnv({ MONGODB_URI: testMongoUri });
  });

  const signupBody = {
    fullName: 'Zurain Rizvi',
    email: 'zurain@example.com',
    phone: '03001234567',
    password: 'password12',
  };

  async function signupAndGetCode() {
    const env = loadEnv();
    const app = createApp(env);
    const res = await request(app).post('/api/auth/signup').send(signupBody);
    expect(res.status).toBe(201);
    expect(res.body.data.debugCode).toMatch(/^\d{6}$/);
    return { app, code: res.body.data.debugCode as string };
  }

  it('signup → verify → login flow', async () => {
    const { app, code } = await signupAndGetCode();

    const verifyRes = await request(app)
      .post('/api/auth/otp/verify')
      .send({ email: signupBody.email, purpose: 'signup', code });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.token).toBeDefined();
    expect(verifyRes.body.data.user.status).toBe('active');

    const loginBefore = await request(app)
      .post('/api/auth/login')
      .send({ email: signupBody.email, password: signupBody.password });
    expect(loginBefore.status).toBe(200);

    const token = verifyRes.body.data.token as string;
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.email).toBe(signupBody.email);
  });

  it('cannot login until OTP verified', async () => {
    const env = loadEnv();
    const app = createApp(env);
    await request(app).post('/api/auth/signup').send(signupBody);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: signupBody.email, password: signupBody.password });

    expect(loginRes.status).toBe(403);
    expect(loginRes.body.message).toMatch(/verify your email/i);
  });

  it('returns 409 for duplicate email', async () => {
    const env = loadEnv();
    const app = createApp(env);
    await request(app).post('/api/auth/signup').send(signupBody);

    const dupRes = await request(app).post('/api/auth/signup').send(signupBody);
    expect(dupRes.status).toBe(409);
  });

  it('returns 401 for wrong password', async () => {
    const { app, code } = await signupAndGetCode();
    await request(app)
      .post('/api/auth/otp/verify')
      .send({ email: signupBody.email, purpose: 'signup', code });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: signupBody.email, password: 'wrongpassword' });

    expect(loginRes.status).toBe(401);
  });

  it('returns 400 for expired OTP', async () => {
    const env = loadEnv();
    const app = createApp(env);
    await request(app).post('/api/auth/signup').send(signupBody);

    await OtpVerification.updateMany(
      { email: signupBody.email },
      { $set: { expiresAt: new Date(Date.now() - 1000) } }
    );

    const verifyRes = await request(app)
      .post('/api/auth/otp/verify')
      .send({ email: signupBody.email, purpose: 'signup', code: '123456' });

    expect(verifyRes.status).toBe(400);
    expect(verifyRes.body.message).toMatch(/expired/i);
  });

  it('locks after 5 wrong OTP attempts until resend', async () => {
    const env = loadEnv();
    const app = createApp(env);
    await request(app).post('/api/auth/signup').send(signupBody);

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/otp/verify')
        .send({ email: signupBody.email, purpose: 'signup', code: '000000' });
    }

    const lockedRes = await request(app)
      .post('/api/auth/otp/verify')
      .send({ email: signupBody.email, purpose: 'signup', code: '000000' });

    expect(lockedRes.status).toBe(400);
    expect(lockedRes.body.message).toMatch(/new verification code/i);

    await OtpVerification.updateMany(
      { email: signupBody.email },
      { $set: { lastSentAt: new Date(Date.now() - 61_000) } }
    );

    const resendRes = await request(app)
      .post('/api/auth/otp/send')
      .send({ email: signupBody.email, purpose: 'signup' });

    expect(resendRes.status).toBe(200);
    expect(resendRes.body.data.debugCode).toMatch(/^\d{6}$/);

    const verifyRes = await request(app)
      .post('/api/auth/otp/verify')
      .send({
        email: signupBody.email,
        purpose: 'signup',
        code: resendRes.body.data.debugCode,
      });

    expect(verifyRes.status).toBe(200);
  });

  it('calls sendOtpEmail when SMTP is configured', async () => {
    resetEnvCache();
    process.env.SMTP_HOST = 'smtp.gmail.com';
    process.env.SMTP_USER = 'test@gmail.com';
    process.env.SMTP_PASS = 'app-password';
    process.env.OTP_DEBUG = 'false';

    const env = loadEnv();
    const app = createApp(env);

    await request(app).post('/api/auth/signup').send({
      ...signupBody,
      email: 'smtp-test@example.com',
    });

    expect(sendOtpEmailMock).toHaveBeenCalledTimes(1);
    expect(sendOtpEmailMock.mock.calls[0][1]).toBe('smtp-test@example.com');
  });

  it('does not leak OTP in response when NODE_ENV is production', async () => {
    resetEnvCache();
    applyTestEnv({ OTP_DEBUG: 'false' });
    process.env.NODE_ENV = 'production';
    delete process.env.SMTP_HOST;

    const env = loadEnv();
    const app = createApp(env);

    const res = await request(app).post('/api/auth/signup').send({
      ...signupBody,
      email: 'prod-test@example.com',
    });

    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).not.toMatch(/\d{6}/);
  });

  it('allows active user to set insurer role', async () => {
    const env = loadEnv();
    const app = createApp(env);

    const signupRes = await request(app).post('/api/auth/signup').send({
      fullName: 'Insurer User',
      email: 'insurer@example.com',
      phone: '03009876543',
      password: 'password12',
    });
    const code = signupRes.body.data.debugCode;

    const verifyRes = await request(app)
      .post('/api/auth/otp/verify')
      .send({ email: 'insurer@example.com', purpose: 'signup', code });

    const roleRes = await request(app)
      .patch('/api/auth/role')
      .set('Authorization', `Bearer ${verifyRes.body.data.token}`)
      .send({ role: 'insurer' });

    expect(roleRes.status).toBe(200);
    expect(roleRes.body.data.user.role).toBe('insurer');
  });
});
