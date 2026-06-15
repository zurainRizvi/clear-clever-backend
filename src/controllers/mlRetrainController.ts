import type { Request, Response } from 'express';
import { isMlModelId } from '../constants/mlModels';
import type { AuthenticatedRequest } from '../middleware/authenticate';
import { AppError, successResponse } from '../utils/apiResponse';
import {
  getMlRetrainReport,
  keepCandidateModel,
  promoteCandidateModel,
  uploadCandidateModel,
} from '../services/mlRegistryService';
import type { MlCandidateReport } from '../models/MlModelRegistry';

function assertMlRetrainApiKey(req: Request): void {
  const configured = process.env.ML_RETRAIN_API_KEY?.trim();
  if (!configured) {
    throw new AppError(503, 'ML retrain upload is not configured');
  }
  const provided = req.header('x-ml-retrain-key')?.trim();
  if (!provided || provided !== configured) {
    throw new AppError(401, 'Invalid ML retrain API key');
  }
}

export async function getAdminMlRetrainReport(
  _req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const report = await getMlRetrainReport();
  res.status(200).json(successResponse('ML retrain report retrieved', report));
}

export async function promoteAdminMlRetrain(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const { modelId } = req.body as { modelId: string };
  if (!isMlModelId(modelId)) {
    throw new AppError(400, 'Invalid modelId');
  }

  await promoteCandidateModel(modelId, req.user!._id);
  const report = await getMlRetrainReport();

  res.status(200).json(
    successResponse('Candidate model promoted', {
      modelId,
      report,
    })
  );
}

export async function keepAdminMlRetrain(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const { modelId } = req.body as { modelId: string };
  if (!isMlModelId(modelId)) {
    throw new AppError(400, 'Invalid modelId');
  }

  await keepCandidateModel(modelId);
  const report = await getMlRetrainReport();

  res.status(200).json(
    successResponse('Candidate model dismissed', {
      modelId,
      report,
    })
  );
}

export async function uploadAdminMlRetrainCandidate(
  req: Request,
  res: Response
): Promise<void> {
  assertMlRetrainApiKey(req);

  const body = req.body as {
    modelId: string;
    candidateVersion: string;
    artifact: Record<string, unknown>;
    meta: Record<string, unknown>;
    report: MlCandidateReport;
  };

  if (!isMlModelId(body.modelId)) {
    throw new AppError(400, 'Invalid modelId');
  }
  if (!body.candidateVersion?.trim() || !body.artifact || !body.report?.metrics) {
    throw new AppError(400, 'candidateVersion, artifact, and report.metrics are required');
  }

  await uploadCandidateModel({
    modelId: body.modelId,
    candidateVersion: body.candidateVersion.trim(),
    artifact: body.artifact as never,
    meta: body.meta ?? {},
    report: body.report,
  });

  res.status(200).json(
    successResponse('Candidate model uploaded', {
      modelId: body.modelId,
      candidateVersion: body.candidateVersion.trim(),
    })
  );
}

export async function triggerAdminMlRetrain(
  _req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const workflow = process.env.ML_RETRAIN_WORKFLOW?.trim() ?? 'ml-retrain-monthly.yml';
  res.status(200).json(
    successResponse('Manual retrain trigger recorded', {
      message:
        'Start the GitHub Actions workflow manually from the repository if workflow dispatch is enabled.',
      workflow,
    })
  );
}
