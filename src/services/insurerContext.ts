import type { Types } from 'mongoose';
import { InsurerProfile, type IInsurerProfileDocument } from '../models/InsurerProfile';
import type { IUserDocument } from '../models/User';
import { AppError } from '../utils/apiResponse';

export async function getInsurerProfileForUser(
  userId: Types.ObjectId | string,
  user?: Pick<IUserDocument, 'status'>
): Promise<IInsurerProfileDocument> {
  if (user && user.status !== 'active') {
    throw new AppError(403, 'Provider account is awaiting admin approval');
  }

  const profile = await InsurerProfile.findOne({ userId });
  if (!profile) {
    throw new AppError(403, 'Complete provider setup first');
  }
  return profile;
}

export async function getInsurerProfileForUserId(
  userId: Types.ObjectId | string
): Promise<IInsurerProfileDocument | null> {
  return InsurerProfile.findOne({ userId });
}

export function toInsurerPolicySummary(policy: {
  _id: Types.ObjectId;
  slug: string;
  name: string;
  category: string;
  status: string;
  premiumMonthlyPkr: number;
  premiumYearlyPkr: number;
  rejectionReason?: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: String(policy._id),
    slug: policy.slug,
    name: policy.name,
    category: policy.category,
    status: policy.status,
    premiumMonthlyPkr: policy.premiumMonthlyPkr,
    premiumYearlyPkr: policy.premiumYearlyPkr,
    rejectionReason: policy.rejectionReason,
    reviewedAt: policy.reviewedAt?.toISOString(),
    createdAt: policy.createdAt.toISOString(),
    updatedAt: policy.updatedAt.toISOString(),
  };
}

export function toInsurerProfileSummary(profile: {
  _id: Types.ObjectId;
  companyName: string;
  slug: string;
  contactEmail: string;
  contactPhone: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: String(profile._id),
    companyName: profile.companyName,
    slug: profile.slug,
    contactEmail: profile.contactEmail,
    contactPhone: profile.contactPhone,
    description: profile.description,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

export function toInsurerPolicyDetail(policy: {
  _id: Types.ObjectId;
  slug: string;
  name: string;
  category: string;
  description: string;
  premiumMonthlyPkr: number;
  premiumYearlyPkr: number;
  coverageSummary: string;
  features: string[];
  deductiblePkr: number;
  questions: unknown[];
  status: string;
  rejectionReason?: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...toInsurerPolicySummary(policy),
    description: policy.description,
    coverageSummary: policy.coverageSummary,
    features: policy.features,
    deductiblePkr: policy.deductiblePkr,
    questions: policy.questions,
  };
}
