import {
  activePremiumScenario,
  addUtcMonths,
  isDaysAfterUtc,
  isPremiumCadenceDay,
  nextPremiumDueDate,
} from './services/reminderSchedule';
import {
  buildPremiumDedupeKey,
  billingPeriodKey,
} from './constants/reminders';
import {
  dispatchReminder,
  scenarioAllowsEmail,
  scenarioAllowsReminder,
} from './services/reminderDispatch';
import { ReminderDispatch } from './models/ReminderDispatch';
import { Notification } from './models/Notification';
import { UserProfile } from './models/UserProfile';
import { User } from './models/User';
import { loadEnv, resetEnvCache } from './config/env';
import { applyTestEnv } from './test/setupEnv';
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from './test/mongoSetup';

describe('Reminder V2 — schedule math', () => {
  it('computes next due date on anniversary day in same month', () => {
    const completed = new Date(Date.UTC(2025, 0, 15, 12, 0, 0));
    const from = new Date(Date.UTC(2026, 5, 10));
    const due = nextPremiumDueDate(completed, from);
    expect(due.toISOString().slice(0, 10)).toBe('2026-06-15');
  });

  it('rolls to next month when anniversary day passed', () => {
    const completed = new Date(Date.UTC(2025, 0, 5));
    const from = new Date(Date.UTC(2026, 5, 20));
    const due = nextPremiumDueDate(completed, from);
    expect(due.toISOString().slice(0, 10)).toBe('2026-07-05');
  });

  it('clamps Jan 31 anniversary to shorter months', () => {
    const completed = new Date(Date.UTC(2025, 0, 31));
    const from = new Date(Date.UTC(2026, 1, 1));
    const due = nextPremiumDueDate(completed, from);
    expect(due.getUTCDate()).toBe(28);
    expect(due.getUTCMonth()).toBe(1);
  });

  it('detects premium cadence windows', () => {
    const due = new Date(Date.UTC(2026, 6, 20));
    const t10 = new Date(Date.UTC(2026, 6, 10));
    expect(isPremiumCadenceDay(t10, due, 10)).toBe(true);
    expect(activePremiumScenario(t10, due)).toBe('premium_t10');
    expect(activePremiumScenario(new Date(Date.UTC(2026, 6, 13)), due)).toBe('premium_t7');
    expect(activePremiumScenario(new Date(Date.UTC(2026, 6, 20)), due)).toBe('premium_due');
  });

  it('builds stable billing period keys', () => {
    const due = new Date(Date.UTC(2026, 5, 15));
    expect(billingPeriodKey(due)).toBe('2026-06');
  });

  it('detects completion milestone day 7', () => {
    const completed = new Date(Date.UTC(2026, 0, 1));
    const day7 = new Date(Date.UTC(2026, 0, 8));
    expect(isDaysAfterUtc(completed, day7, 7)).toBe(true);
    expect(isDaysAfterUtc(completed, new Date(Date.UTC(2026, 0, 7)), 7)).toBe(false);
  });

  it('addUtcMonths clamps end of month', () => {
    const base = new Date(Date.UTC(2026, 0, 31));
    const next = addUtcMonths(base, 1);
    expect(next.getUTCMonth()).toBe(1);
    expect(next.getUTCDate()).toBe(28);
  });
});

describe('Reminder V2 — preference gates', () => {
  it('respects policy and claim preferences', () => {
    const prefs = { emailUpdates: true, claimAlerts: false, policyReminders: false };
    expect(scenarioAllowsReminder('premium_t7', prefs)).toBe(false);
    expect(scenarioAllowsReminder('claim_followup_7d', prefs)).toBe(false);
    expect(scenarioAllowsReminder('approval_pending_insurer', prefs)).toBe(true);
    expect(scenarioAllowsEmail('premium_t3', prefs)).toBe(false);
    expect(scenarioAllowsEmail('claim_followup_7d', prefs)).toBe(false);
  });
});

describe('Reminder V2 — dispatch idempotency', () => {
  let testMongoUri = '';

  beforeAll(async () => {
    testMongoUri = await connectTestDatabase();
    applyTestEnv({ MONGODB_URI: testMongoUri, OTP_DEBUG: 'true' });
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    applyTestEnv({ MONGODB_URI: testMongoUri, OTP_DEBUG: 'true' });
    resetEnvCache();
  });

  it('dispatches once per dedupe key', async () => {
    const env = loadEnv();
    const user = await User.create({
      email: 'reminder@test.com',
      passwordHash: 'x',
      fullName: 'Reminder Test',
      phone: '+923001234567',
      role: 'user',
      status: 'active',
    });
    await UserProfile.create({ userId: user._id });

    const key = buildPremiumDedupeKey('purchase123', 'premium_t7', '2026-06');
    const payload = {
      dedupeKey: key,
      userId: String(user._id),
      scenario: 'premium_t7' as const,
      title: 'Premium reminder',
      body: 'Due in 7 days',
      metadata: { purchaseId: 'purchase123' },
      sendEmail: false,
    };

    const first = await dispatchReminder(env, payload);
    const second = await dispatchReminder(env, payload);

    expect(first).toBe(true);
    expect(second).toBe(false);

    const dispatches = await ReminderDispatch.countDocuments({ dedupeKey: key });
    const notifications = await Notification.countDocuments({ userId: user._id });
    expect(dispatches).toBe(1);
    expect(notifications).toBe(1);
  });

  it('skips when policyReminders disabled', async () => {
    const env = loadEnv();
    const user = await User.create({
      email: 'noreminder@test.com',
      passwordHash: 'x',
      fullName: 'No Reminder',
      phone: '+923001234568',
      role: 'user',
      status: 'active',
    });
    await UserProfile.create({
      userId: user._id,
      notificationPreferences: {
        emailUpdates: true,
        claimAlerts: true,
        policyReminders: false,
      },
    });

    const sent = await dispatchReminder(env, {
      dedupeKey: 'purchase:abc:premium_due:2026-06',
      userId: String(user._id),
      scenario: 'premium_due',
      title: 'Premium due',
      body: 'Due today',
      sendEmail: false,
    });

    expect(sent).toBe(false);
    expect(await Notification.countDocuments({ userId: user._id })).toBe(0);
  });
});
