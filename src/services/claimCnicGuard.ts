import type { IUserDocument } from '../models/User';
import { AppError } from '../utils/apiResponse';

export function assertUserHasCnic(user: IUserDocument): void {
  if (!user.cnic?.trim()) {
    throw new AppError(403, 'CNIC required before filing a claim', [
      'Add your CNIC to your profile before submitting or analyzing a claim. This verifies you are the account holder.',
    ]);
  }
}
