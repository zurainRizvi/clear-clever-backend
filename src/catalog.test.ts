import express from 'express';
import request from 'supertest';
import { createApp } from './app';
import { CATEGORIES, POLICY_CATEGORY_SLUGS } from './constants/categories';
import { loadEnv, resetEnvCache } from './config/env';
import { InsurerProfile } from './models/InsurerProfile';
import { Policy } from './models/Policy';
import { User } from './models/User';
import { SEED_INSURERS } from './seed/insurerSeedData';
import {
  SEED_APPROVED_POLICY_COUNT,
  SEED_PENDING_POLICY_COUNT,
  SEED_POLICY_COUNT,
} from './seed/policySeedData';
import { seedAll } from './seed/seedCatalog';
import { SEED_USERS } from './seed/userSeedData';
import { applyTestEnv } from './test/setupEnv';
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from './test/mongoSetup';
import { validate } from './middleware/validate';
import { policyCategoryValidator } from './validators/policyValidators';

describe('Module 4 — Catalog, insurers & seed policies', () => {
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
  });

  describe('GET /api/categories', () => {
    it('returns five categories with others unavailable', async () => {
      const app = createApp(loadEnv());
      const res = await request(app).get('/api/categories');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.categories).toHaveLength(5);

      const slugs = res.body.data.categories.map((c: { slug: string }) => c.slug);
      expect(slugs).toEqual(CATEGORIES.map((c) => c.slug));

      const others = res.body.data.categories.find((c: { slug: string }) => c.slug === 'others');
      expect(others).toMatchObject({
        slug: 'others',
        name: 'Other Insurance',
        available: false,
      });

      const active = res.body.data.categories.filter((c: { available: boolean }) => c.available);
      expect(active).toHaveLength(4);
    });
  });

  describe('Catalog seed', () => {
    it('is idempotent and seeds insurers plus policies', async () => {
      const first = await seedAll();
      expect(first.users.created).toBe(SEED_USERS.length);
      expect(first.catalog.insurersCreated).toBe(SEED_INSURERS.length);
      expect(first.catalog.policiesCreated).toBe(SEED_POLICY_COUNT);

      const second = await seedAll();
      expect(second.users.created).toBe(0);
      expect(second.users.updated).toBe(SEED_USERS.length);
      expect(second.catalog.insurersCreated).toBe(0);
      expect(second.catalog.insurersUpdated).toBe(SEED_INSURERS.length);
      expect(second.catalog.policiesCreated).toBe(0);
      expect(second.catalog.policiesUpdated).toBe(SEED_POLICY_COUNT);

      expect(await InsurerProfile.countDocuments()).toBe(SEED_INSURERS.length);
      expect(await Policy.countDocuments()).toBe(SEED_POLICY_COUNT);
    });

    it('links insurer users to profiles', async () => {
      await seedAll();

      for (const insurer of SEED_INSURERS) {
        const user = await User.findOne({ email: insurer.insurerEmail });
        expect(user?.role).toBe('insurer');

        const profile = await InsurerProfile.findOne({ slug: insurer.slug });
        expect(profile).not.toBeNull();
        expect(String(profile?.userId)).toBe(String(user?._id));
        expect(profile?.companyName).toBe(insurer.companyName);
      }
    });

    it('seeds approved and pending policies with valid categories only', async () => {
      await seedAll();

      const approved = await Policy.find({ status: 'approved' });
      const pending = await Policy.find({ status: 'pending' });

      expect(approved).toHaveLength(SEED_APPROVED_POLICY_COUNT);
      expect(pending).toHaveLength(SEED_PENDING_POLICY_COUNT);

      for (const policy of [...approved, ...pending]) {
        expect(POLICY_CATEGORY_SLUGS).toContain(policy.category);
      }

      for (const category of POLICY_CATEGORY_SLUGS) {
        const count = await Policy.countDocuments({ category });
        expect(count).toBeGreaterThanOrEqual(3);
      }
    });

    it('assigns affiliate slugs to insurers', async () => {
      await seedAll();

      const slugs = await InsurerProfile.find().select('slug').sort({ slug: 1 });
      expect(slugs.map((s) => s.slug)).toEqual([
        'adamjee-insurance',
        'jubilee-insurance',
        'tpl-insurance',
      ]);
    });
  });

  describe('Policy category validation', () => {
    it('rejects invalid category on policy create at schema level', async () => {
      await seedAll();
      const profile = await InsurerProfile.findOne({ slug: 'tpl-insurance' });
      expect(profile).not.toBeNull();

      await expect(
        Policy.create({
          insurerProfileId: profile!._id,
          slug: 'invalid-category-test',
          name: 'Invalid Category Test',
          category: 'others',
          description: 'Should fail validation.',
          premiumMonthlyPkr: 1000,
          premiumYearlyPkr: 12000,
          coverageSummary: 'N/A',
          features: [],
          deductiblePkr: 0,
          questions: [],
          status: 'pending',
        })
      ).rejects.toThrow(/validation failed/i);
    });

    it('rejects invalid category via policy create validator', async () => {
      const validatorApp = express();
      validatorApp.use(express.json());
      validatorApp.post(
        '/test-policy-create',
        validate([policyCategoryValidator]),
        (_req, res) => {
          res.status(201).json({ success: true });
        }
      );

      const res = await request(validatorApp)
        .post('/test-policy-create')
        .send({ category: 'others' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Validation failed');
      expect(res.body.errors.some((e: string) => e.includes('category'))).toBe(true);
    });

    it('accepts valid policy categories via validator', async () => {
      const validatorApp = express();
      validatorApp.use(express.json());
      validatorApp.post(
        '/test-policy-create',
        validate([policyCategoryValidator]),
        (_req, res) => {
          res.status(201).json({ success: true });
        }
      );

      for (const category of POLICY_CATEGORY_SLUGS) {
        const res = await request(validatorApp)
          .post('/test-policy-create')
          .send({ category });

        expect(res.status).toBe(201);
      }
    });
  });
});
