import type { IUserDocument } from '../models/User';
import { User } from '../models/User';
import { AppError } from '../utils/apiResponse';
import { normalizeCnic } from '../utils/cnic';
import { deriveFromCnic } from './kycService';

export async function assignUserCnic(user: IUserDocument, rawCnic: string): Promise<void> {
  const normalized = normalizeCnic(rawCnic);
  const duplicate = await User.findOne({
    cnic: normalized,
    _id: { $ne: user._id },
  });
  if (duplicate) {
    throw new AppError(409, 'This CNIC is already registered to another account');
  }
  user.cnic = normalized;
  await user.save();
  try {
    await deriveFromCnic(user);
  } catch {
    // Local derivation is best-effort; CNIC assignment still succeeds.
  }
}
