import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { createApp } from './app';
import { loadEnv, resetEnvCache } from './config/env';
import { MlModelRegistry } from './models/MlModelRegistry';
import { SEED_DEFAULT_PASSWORD } from './seed/userSeedData';
import { seedAll } from './seed/seedCatalog';
import { applyTestEnv } from './test/setupEnv';
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from './test/mongoSetup';
import { resetClaimRiskModelCache } from './ml/claimRiskModel';
import { refreshMlRegistryCache } from './services/mlRegistryService';

describe('ML retrain registry', () => {
  let testMongoUri = '';
  let app: ReturnType<typeof createApp>;
  let superToken = '';

  async function login(email: string): Promise<string> {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: SEED_DEFAULT_PASSWORD });
    return res.body.data.token;
  }

  beforeAll(async () => {
    testMongoUri = await connectTestDatabase();
    applyTestEnv({
      MONGODB_URI: testMongoUri,
      ML_RETRAIN_API_KEY: 'test-retrain-key',
    });
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  afterEach(async () => {
    for (const file of ['claim_risk_v2.json', 'claim_risk_v2.meta.json']) {
      const artifactPath = path.join(__dirname, 'ml/artifacts', file);
      if (fs.existsSync(artifactPath)) {
        fs.unlinkSync(artifactPath);
      }
    }
    resetClaimRiskModelCache();
    await refreshMlRegistryCache();
  });

  beforeEach(async () => {
    await clearDatabase();
    applyTestEnv({
      MONGODB_URI: testMongoUri,
      ML_RETRAIN_API_KEY: 'test-retrain-key',
    });
    resetEnvCache();
    await seedAll();
    app = createApp(loadEnv());
    superToken = await login('superadmin@clearclever.com');
  });

  it('uploads, reports, promotes, and serves a candidate claim risk model', async () => {
    const activeArtifact = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, 'ml/artifacts/claim_risk_v1.json'),
        'utf8'
      )
    ) as Record<string, unknown>;
    const candidateVersion = 'claim_risk_v2';
    const candidateArtifact = {
      ...activeArtifact,
      version: candidateVersion,
      trainedAt: new Date().toISOString(),
    };

    const uploadRes = await request(app)
      .post('/api/internal/ml-retrain/candidate')
      .set('x-ml-retrain-key', 'test-retrain-key')
      .send({
        modelId: 'claim_risk',
        candidateVersion,
        artifact: candidateArtifact,
        meta: {
          version: candidateVersion,
          trainedAt: candidateArtifact.trainedAt,
          metrics: {
            accuracy: 0.84,
            roc_auc: 0.86,
            precision: 0.7,
            recall: 0.74,
            f1: 0.72,
            train_rows: 8100,
            test_rows: 2000,
          },
        },
        report: {
          trainedAt: candidateArtifact.trainedAt,
          metrics: {
            accuracy: 0.84,
            roc_auc: 0.86,
            precision: 0.7,
            recall: 0.74,
            f1: 0.72,
            train_rows: 8100,
            test_rows: 2000,
          },
          realRowPct: 12,
          syntheticRowPct: 88,
          totalRows: 10100,
        },
      });

    expect(uploadRes.status).toBe(200);

    const reportRes = await request(app)
      .get('/api/admin/ml-retrain/report')
      .set('Authorization', `Bearer ${superToken}`);

    expect(reportRes.status).toBe(200);
    const claimModel = reportRes.body.data.models.find(
      (model: { modelId: string }) => model.modelId === 'claim_risk'
    );
    expect(claimModel.hasCandidate).toBe(true);
    expect(claimModel.candidateVersion).toBe(candidateVersion);

    const promoteRes = await request(app)
      .post('/api/admin/ml-retrain/promote')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ modelId: 'claim_risk' });

    expect(promoteRes.status).toBe(200);

    const registry = await MlModelRegistry.findOne({ modelId: 'claim_risk' });
    expect(registry?.activeVersion).toBe(candidateVersion);
    expect(registry?.candidateVersion).toBeUndefined();

    resetClaimRiskModelCache();
    await refreshMlRegistryCache();
  });
});
