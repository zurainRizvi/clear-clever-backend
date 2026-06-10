import request from 'supertest';
import { createApp } from './app';
import { loadEnv, resetEnvCache } from './config/env';
import { ClaimRequest } from './models/ClaimRequest';
import { Policy } from './models/Policy';
import { User } from './models/User';
import type { IUserDocument } from './models/User';
import { SEED_DEFAULT_PASSWORD } from './seed/userSeedData';
import { seedAll } from './seed/seedCatalog';
import { applyTestEnv } from './test/setupEnv';
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from './test/mongoSetup';
import * as geminiService from './services/geminiService';
import {
  computeClaimReadiness,
  computeInsurerRecommendation,
  enrichClaimIntelligenceReport,
} from './services/claimIntelligenceService';
import { namesMatch } from './services/identityVerificationService';
import type { GeminiClaimIntelligenceRaw } from './types/claimIntelligence';

jest.mock('./services/geminiService', () => {
  const actual = jest.requireActual<typeof import('./services/geminiService')>(
    './services/geminiService'
  );
  return {
    ...actual,
    generateStructuredJson: jest.fn(),
  };
});

const mockStructuredJson = geminiService.generateStructuredJson as jest.MockedFunction<
  typeof geminiService.generateStructuredJson
>;

const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function attachmentPayload() {
  return [
    {
      mimeType: 'image/png',
      fileName: 'damage.png',
      dataBase64: TINY_PNG_BASE64,
    },
  ];
}

function vehicleGeminiRaw(overrides: Partial<GeminiClaimIntelligenceRaw> = {}): GeminiClaimIntelligenceRaw {
  return {
    analysisTypes: ['vehicle'],
    vehicle: {
      severity: 'moderate',
      severityConfidence: 87,
      damagedParts: ['Front Bumper', 'Left Headlight'],
      repairComplexity: 'medium',
      estimatedCostMinPkr: 30000,
      estimatedCostMaxPkr: 60000,
    },
    consistency: {
      level: 'low',
      reason: 'Image shows front bumper damage but description mentions rear impact.',
    },
    suspiciousFlags: ['Image quality too low'],
    executiveSummary:
      'Vehicle damage appears moderate. Estimated repair PKR 30,000–60,000. Consistency concern noted.',
    ...overrides,
  };
}

describe('AI Claims Intelligence Engine', () => {
  let testMongoUri = '';
  let app: ReturnType<typeof createApp>;
  let seekerToken = '';
  let tplToken = '';

  async function login(email: string): Promise<string> {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: SEED_DEFAULT_PASSWORD });
    return res.body.data.token;
  }

  async function completePurchase(): Promise<string> {
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
    const purchaseId = createRes.body.data.purchaseId as string;

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

    return purchaseId;
  }

  beforeAll(async () => {
    testMongoUri = await connectTestDatabase();
    applyTestEnv({ MONGODB_URI: testMongoUri, GEMINI_API_KEY: 'test-key' });
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    applyTestEnv({ MONGODB_URI: testMongoUri, GEMINI_API_KEY: 'test-key' });
    resetEnvCache();
    mockStructuredJson.mockReset();
    await seedAll();
    app = createApp(loadEnv());
    seekerToken = await login('seeker@clearclever.com');
    tplToken = await login('insurer.tpl@clearclever.com');
  });

  describe('enrichment helpers', () => {
    it('matches profile names with token overlap', () => {
      expect(namesMatch('Ayesha Khan', 'Ayesha Khan')).toBe(true);
      expect(namesMatch('Ayesha Khan', 'Khan Ayesha')).toBe(true);
      expect(namesMatch('Ayesha Khan', 'Muhammad Ali')).toBe(false);
    });

    it('computes readiness score from four checks', () => {
      const ready = computeClaimReadiness({
        attachmentCount: 2,
        suspiciousFlags: [],
        consistencyLevel: 'high',
        identityMatch: true,
        policyMatch: true,
        policyCategoryAligned: true,
        cnicDocumentUploaded: true,
      });
      expect(ready.score).toBe(100);
      expect(ready.documentsComplete).toBe(true);
      expect(ready.noMajorIssues).toBe(true);

      const weak = computeClaimReadiness({
        attachmentCount: 1,
        suspiciousFlags: ['Image quality too low', 'Damage area partially hidden'],
        consistencyLevel: 'low',
        identityMatch: false,
      });
      expect(weak.score).toBeLessThan(100);
      expect(weak.informationConsistent).toBe(false);
    });

    it('derives insurer recommendation tiers', () => {
      expect(
        computeInsurerRecommendation({
          consistencyLevel: 'low',
          readinessScore: 90,
          suspiciousFlags: [],
        })
      ).toBe('escalate_review');

      expect(
        computeInsurerRecommendation({
          consistencyLevel: 'high',
          readinessScore: 75,
          suspiciousFlags: [],
        })
      ).toBe('manual_review');

      expect(
        computeInsurerRecommendation({
          consistencyLevel: 'high',
          readinessScore: 100,
          suspiciousFlags: [],
        })
      ).toBe('standard_review');
    });

    it('enriches vehicle analysis with consistency and PKR range', () => {
      const seeker = { fullName: 'Ayesha Khan' } as IUserDocument;
      const report = enrichClaimIntelligenceReport({
        raw: vehicleGeminiRaw(),
        user: seeker,
        purchaseId: '507f1f77bcf86cd799439011',
        claimType: 'accident',
        policyName: 'TPL Home Essential',
        policyCategory: 'home',
        insurerName: 'TPL Insurance',
        attachments: [{ mimeType: 'image/png', fileName: 'x.png', dataBase64: 'abc' }],
        modelVersion: 'gemini-2.5-flash',
      });

      expect(report.policyAlignment.matchesPolicyCategory).toBe(false);

      expect(report.vehicle?.severity).toBe('moderate');
      expect(report.vehicle?.damagedParts).toContain('Front Bumper');
      expect(report.consistency.level).toBe('low');
      expect(report.reportVersion).toBe('1');
    });

    it('validates CNIC name and number against user profile', () => {
      const seeker = { fullName: 'Ayesha Khan', cnic: '42101-1234567-1' } as IUserDocument;
      const report = enrichClaimIntelligenceReport({
        raw: vehicleGeminiRaw({
          analysisTypes: ['identity'],
          identity: {
            documentType: 'CNIC',
            extractedName: 'Ayesha Khan',
            extractedCnic: '42101-1234567-1',
            expiryStatus: 'valid',
          },
        }),
        user: seeker,
        purchaseId: '507f1f77bcf86cd799439011',
        claimType: 'damage',
        attachments: [{ mimeType: 'image/png', fileName: 'cnic.png', dataBase64: 'abc' }],
        modelVersion: 'gemini-2.5-flash',
      });

      expect(report.identity?.matchesName).toBe(true);
      expect(report.identity?.matchesCnic).toBe(true);
      expect(report.identity?.matchesUserProfile).toBe(true);
    });

    it('fails verification when CNIC does not match registered account', () => {
      const seeker = { fullName: 'Ayesha Khan', cnic: '42101-1234567-1' } as IUserDocument;
      const report = enrichClaimIntelligenceReport({
        raw: vehicleGeminiRaw({
          analysisTypes: ['identity'],
          identity: {
            documentType: 'CNIC',
            extractedName: 'Ayesha Khan',
            extractedCnic: '35202-7654321-9',
            expiryStatus: 'valid',
          },
        }),
        user: seeker,
        purchaseId: '507f1f77bcf86cd799439011',
        claimType: 'damage',
        attachments: [{ mimeType: 'image/png', fileName: 'cnic.png', dataBase64: 'abc' }],
        modelVersion: 'gemini-2.5-flash',
      });

      expect(report.identity?.matchesName).toBe(true);
      expect(report.identity?.matchesCnic).toBe(false);
      expect(report.identity?.matchesUserProfile).toBe(false);
    });

    it('validates policy number against synthetic CC- number', () => {
      const purchaseId = '507f1f77bcf86cd799439011';
      const expected = `CC-${purchaseId.slice(-8).toUpperCase()}`;
      const seeker = { fullName: 'Ayesha Khan' } as IUserDocument;

      const report = enrichClaimIntelligenceReport({
        raw: vehicleGeminiRaw({
          analysisTypes: ['policy'],
          policyDoc: {
            policyNumber: expected,
            insurer: 'TPL Insurance',
            policyType: 'Home Insurance',
            expiryDate: '2027-01-01',
          },
        }),
        user: seeker,
        purchaseId,
        claimType: 'damage',
        policyName: 'TPL Home Essential',
        policyCategory: 'home',
        insurerName: 'TPL Insurance',
        attachments: [{ mimeType: 'application/pdf', fileName: 'policy.pdf', dataBase64: 'abc' }],
        modelVersion: 'gemini-2.5-flash',
      });

      expect(report.policyDoc?.matchesLinkedPolicy).toBe(true);
    });
  });

  describe('POST /api/claims/analyze-intelligence', () => {
    it('returns structured intelligence report for vehicle claim', async () => {
      const purchaseId = await completePurchase();
      mockStructuredJson.mockResolvedValue(vehicleGeminiRaw());

      const res = await request(app)
        .post('/api/claims/analyze-intelligence')
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({
          purchaseId,
          claimType: 'accident',
          description: 'Vehicle hit from rear.',
          estimatedAmountPkr: 45000,
          incidentDate: new Date().toISOString(),
          attachments: attachmentPayload(),
        });

      expect(res.status).toBe(200);
      expect(res.body.data.intelligenceReport.vehicle.severity).toBe('moderate');
      expect(res.body.data.intelligenceReport.consistency.level).toBe('low');
      expect(res.body.data.intelligenceReport.claimReadiness.score).toBeDefined();
      expect(mockStructuredJson).toHaveBeenCalled();
    });

    it('requires at least one attachment', async () => {
      const purchaseId = await completePurchase();

      const res = await request(app)
        .post('/api/claims/analyze-intelligence')
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({
          purchaseId,
          claimType: 'damage',
          description: 'Water damage in kitchen area.',
          attachments: [],
        });

      expect(res.status).toBe(400);
    });

    it('requires authentication', async () => {
      const res = await request(app)
        .post('/api/claims/analyze-intelligence')
        .send({
          purchaseId: '507f1f77bcf86cd799439011',
          claimType: 'damage',
          description: 'Test claim description here.',
          attachments: attachmentPayload(),
        });

      expect(res.status).toBe(401);
    });

    it('allows analysis without CNIC on profile and flags gaps in the report', async () => {
      const purchaseId = await completePurchase();
      const user = await User.findOne({ email: 'seeker@clearclever.com' });
      expect(user).toBeTruthy();
      user!.cnic = undefined;
      await user!.save();

      mockStructuredJson.mockResolvedValue(vehicleGeminiRaw());

      const res = await request(app)
        .post('/api/claims/analyze-intelligence')
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({
          purchaseId,
          claimType: 'accident',
          description: 'Front bumper damage after collision.',
          attachments: attachmentPayload(),
        });

      expect(res.status).toBe(200);
      expect(res.body.data.intelligenceReport.submissionChecklist.readyToSubmit).toBe(false);
      expect(res.body.data.intelligenceReport.approvalImprovements.length).toBeGreaterThan(0);
    });
  });

  describe('claim persistence with intelligence report', () => {
    it('persists intelligenceReport on create and returns on GET', async () => {
      const purchaseId = await completePurchase();
      mockStructuredJson.mockResolvedValue(vehicleGeminiRaw());

      const analyzeRes = await request(app)
        .post('/api/claims/analyze-intelligence')
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({
          purchaseId,
          claimType: 'accident',
          description: 'Front bumper damage after collision.',
          attachments: attachmentPayload(),
        });

      const report = analyzeRes.body.data.intelligenceReport;

      const createRes = await request(app)
        .post('/api/claims')
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({
          purchaseId,
          claimType: 'accident',
          incidentDate: new Date().toISOString(),
          estimatedAmountPkr: 45000,
          description: 'Front bumper damage after collision.',
          intelligenceReport: report,
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.data.claim.intelligenceReport).toBeDefined();
      expect(createRes.body.data.claim.intelligenceReport.vehicle.severity).toBe('moderate');

      const stored = await ClaimRequest.findById(createRes.body.data.claim.id);
      expect(stored?.intelligenceReport?.reportVersion).toBe('1');

      const getRes = await request(app)
        .get(`/api/claims/${createRes.body.data.claim.id}`)
        .set('Authorization', `Bearer ${seekerToken}`);

      expect(getRes.body.data.claim.intelligenceReport.executiveSummary).toBeTruthy();
    });

    it('includes intelligenceReport and mlRisk on insurer claims list', async () => {
      const purchaseId = await completePurchase();
      mockStructuredJson.mockResolvedValue(vehicleGeminiRaw());

      const analyzeRes = await request(app)
        .post('/api/claims/analyze-intelligence')
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({
          purchaseId,
          claimType: 'accident',
          description: 'Front bumper damage after collision.',
          attachments: attachmentPayload(),
        });

      await request(app)
        .post('/api/claims')
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({
          purchaseId,
          claimType: 'accident',
          incidentDate: new Date().toISOString(),
          estimatedAmountPkr: 45000,
          description: 'Front bumper damage after collision.',
          intelligenceReport: analyzeRes.body.data.intelligenceReport,
        });

      const listRes = await request(app)
        .get('/api/insurer/claims')
        .set('Authorization', `Bearer ${tplToken}`);

      expect(listRes.status).toBe(200);
      const claim = listRes.body.data.claims[0];
      expect(claim.intelligenceReport).toBeDefined();
      expect(claim.mlRisk).toBeDefined();
      expect(claim.mlRisk.score).toBeGreaterThanOrEqual(0);
    });
  });
});
