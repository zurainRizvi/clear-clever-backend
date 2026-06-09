import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/authenticate';
import { deriveFromCnic, getKycStatus, verifyCnicDocument } from '../services/kycService';
import { successResponse } from '../utils/apiResponse';

export async function deriveKycHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { cnic } = req.body as { cnic?: string };
  const report = await deriveFromCnic(req.user!, cnic);
  res.status(200).json(successResponse('CNIC local derivation complete', { kyc: report }));
}

export async function verifyKycHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { attachment } = req.body as { attachment?: unknown };
  const report = await verifyCnicDocument(req.user!, attachment ? [attachment] : []);
  res.status(200).json(successResponse('AI KYC verification complete', { kyc: report }));
}

export async function getKycStatusHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const report = await getKycStatus(req.user!._id);
  res.status(200).json(successResponse('KYC status', { kyc: report }));
}
