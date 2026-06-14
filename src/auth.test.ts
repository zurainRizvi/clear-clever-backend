import request from 'supertest';
import { createApp } from './app';
import { loadEnv, resetEnvCache } from './config/env';
import { OtpVerification } from './models/OtpVerification';
import { UserProfile } from './models/UserProfile';
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
    password: 'Password12',
  };

  async function signupAndGetCode() {
    const env = loadEnv();
    const app = createApp(env);
    const res = await request(app).post('/api/auth/signup').send(signupBody);
    expect(res.status).toBe(201);
    expect(res.body.data.debugCode).toMatch(/^\d{6}$/);
    expect(res.body.data.profile.notificationPreferences.emailUpdates).toBe(true);
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

  it('creates a durable user profile during signup', async () => {
    const env = loadEnv();
    const app = createApp(env);
    const signupRes = await request(app).post('/api/auth/signup').send(signupBody);

    expect(signupRes.status).toBe(201);
    expect(signupRes.body.data.profile).toBeDefined();

    const profile = await UserProfile.findOne({ userId: signupRes.body.data.profile.userId });
    expect(profile).toBeTruthy();
    expect(profile?.notificationPreferences.policyReminders).toBe(true);
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

    const deadline = Date.now() + 5000;
    while (sendOtpEmailMock.mock.calls.length === 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }

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

    expect(res.status).toBe(201);
    expect(res.body.data.emailSent).toBeFalsy();
    expect(res.body.data.debugCode).toBeUndefined();
    expect(JSON.stringify(res.body.data)).not.toMatch(/"debugCode"\s*:\s*"\d{6}"/);
  });

  it('allows active user to set insurer role', async () => {
    const env = loadEnv();
    const app = createApp(env);

    const signupRes = await request(app).post('/api/auth/signup').send({
      fullName: 'Insurer User',
      email: 'insurer@example.com',
      phone: '03009876543',
      password: 'Password12',
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

  it('persists authenticated profile settings', async () => {
    const { app, code } = await signupAndGetCode();
    const verifyRes = await request(app)
      .post('/api/auth/otp/verify')
      .send({ email: signupBody.email, purpose: 'signup', code });

    const token = verifyRes.body.data.token as string;
    const updateRes = await request(app)
      .patch('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({
        profilePhotoDataUrl: 'data:image/png;base64,abc123',
        notificationPreferences: { claimAlerts: false },
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.user.profile.profilePhotoDataUrl).toBe(
      'data:image/png;base64,abc123'
    );
    expect(updateRes.body.data.user.profile.notificationPreferences.claimAlerts).toBe(false);

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(meRes.body.data.user.profile.notificationPreferences.claimAlerts).toBe(false);
  });

  async function activateUser(app: ReturnType<typeof createApp>) {
    const signupRes = await request(app).post('/api/auth/signup').send(signupBody);
    const code = signupRes.body.data.debugCode as string;
    await request(app)
      .post('/api/auth/otp/verify')
      .send({ email: signupBody.email, purpose: 'signup', code });
    return signupRes;
  }

  it('forgot-password → reset-password → login with new password', async () => {
    const env = loadEnv();
    const app = createApp(env);
    await activateUser(app);

    const forgotRes = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: signupBody.email });

    expect(forgotRes.status).toBe(200);
    expect(forgotRes.body.message).toMatch(/reset link/i);
    expect(forgotRes.body.data.resetUrl).toContain('/reset-password?token=');

    const resetUrl = forgotRes.body.data.resetUrl as string;
    const token = new URL(resetUrl).searchParams.get('token');
    expect(token).toBeTruthy();

    const resetRes = await request(app).post('/api/auth/reset-password').send({
      token,
      password: 'Newpassword1',
      confirmPassword: 'Newpassword1',
    });

    expect(resetRes.status).toBe(200);
    expect(resetRes.body.data.message).toMatch(/sign in/i);
    expect(resetRes.body.data.token).toBeUndefined();

    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: signupBody.email, password: signupBody.password });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: signupBody.email, password: 'Newpassword1' });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.data.token).toBeDefined();
  });

  it('forgot-password returns generic message for unknown email', async () => {
    const env = loadEnv();
    const app = createApp(env);

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'unknown@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/reset link/i);
    expect(res.body.data.resetUrl).toBeUndefined();
    expect(res.body.data.emailSent).toBeNull();
  });

  it('rejects invalid reset token', async () => {
    const env = loadEnv();
    const app = createApp(env);

    const res = await request(app).post('/api/auth/reset-password').send({
      token: 'not-a-valid-token',
      password: 'Newpassword1',
      confirmPassword: 'Newpassword1',
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid|expired/i);
  });

  it('rejects expired reset token', async () => {
    const env = loadEnv();
    const app = createApp(env);
    await activateUser(app);

    const forgotRes = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: signupBody.email });

    const resetUrl = forgotRes.body.data.resetUrl as string;
    const token = new URL(resetUrl).searchParams.get('token')!;

    await OtpVerification.updateMany(
      { email: signupBody.email, purpose: 'reset' },
      { $set: { expiresAt: new Date(Date.now() - 1000) } }
    );

    const res = await request(app).post('/api/auth/reset-password').send({
      token,
      password: 'Newpassword1',
      confirmPassword: 'Newpassword1',
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/expired/i);
  });

  it('rejects already-used reset token', async () => {
    const env = loadEnv();
    const app = createApp(env);
    await activateUser(app);

    const forgotRes = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: signupBody.email });

    const resetUrl = forgotRes.body.data.resetUrl as string;
    const token = new URL(resetUrl).searchParams.get('token')!;

    const first = await request(app).post('/api/auth/reset-password').send({
      token,
      password: 'Newpassword1',
      confirmPassword: 'Newpassword1',
    });
    expect(first.status).toBe(200);

    const second = await request(app).post('/api/auth/reset-password').send({
      token,
      password: 'Anotherpass1',
      confirmPassword: 'Anotherpass1',
    });
    expect(second.status).toBe(400);
  });

  it('rejects reset when passwords do not match', async () => {
    const env = loadEnv();
    const app = createApp(env);
    await activateUser(app);

    const forgotRes = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: signupBody.email });

    const token = new URL(forgotRes.body.data.resetUrl as string).searchParams.get('token')!;

    const res = await request(app).post('/api/auth/reset-password').send({
      token,
      password: 'Newpassword1',
      confirmPassword: 'Differentpass1',
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
    expect(JSON.stringify(res.body.errors ?? res.body.data?.errors ?? [])).toMatch(/match/i);
  });

  it('rejects verifyOtp with reset purpose', async () => {
    const env = loadEnv();
    const app = createApp(env);

    const res = await request(app).post('/api/auth/otp/verify').send({
      email: signupBody.email,
      purpose: 'reset',
      code: '123456',
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/reset link/i);
  });
});
