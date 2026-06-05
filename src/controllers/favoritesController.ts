import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/authenticate';
import { Favorite } from '../models/Favorite';
import { Policy } from '../models/Policy';
import { trackFavoriteLead } from '../services/leadTrackingService';
import { enrichPolicies } from '../services/policyPresentation';
import { AppError, successResponse } from '../utils/apiResponse';

export async function listFavorites(req: AuthenticatedRequest, res: Response): Promise<void> {
  const favorites = await Favorite.find({ userId: req.user!._id }).sort({ createdAt: -1 });
  const policyIds = favorites.map((favorite) => favorite.policyId);
  const policies = await Policy.find({
    _id: { $in: policyIds },
    status: 'approved',
  });

  const publicPolicies = await enrichPolicies(policies);
  const policyById = new Map(publicPolicies.map((policy) => [policy.id, policy]));

  const items = favorites
    .map((favorite) => {
      const policy = policyById.get(String(favorite.policyId));
      if (!policy) {
        return null;
      }
      return {
        favoriteId: String(favorite._id),
        savedAt: favorite.createdAt.toISOString(),
        policy,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  res.status(200).json(
    successResponse('Favorites retrieved', {
      count: items.length,
      favorites: items,
    })
  );
}

export async function addFavorite(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { policyId } = req.body as { policyId: string };

  const policy = await Policy.findById(policyId);
  if (!policy || policy.status !== 'approved') {
    throw new AppError(404, 'Policy not found');
  }

  const existing = await Favorite.findOne({
    userId: req.user!._id,
    policyId: policy._id,
  });
  if (existing) {
    throw new AppError(409, 'Policy is already in favorites');
  }

  const favorite = await Favorite.create({
    userId: req.user!._id,
    policyId: policy._id,
  });

  const [publicPolicy] = await enrichPolicies([policy]);

  await trackFavoriteLead({
    userId: req.user!._id,
    policyId: policy._id,
    insurerProfileId: policy.insurerProfileId,
    policyName: policy.name,
    category: policy.category,
  });

  res.status(201).json(
    successResponse('Policy saved to favorites', {
      favoriteId: String(favorite._id),
      policy: publicPolicy,
    })
  );
}

export async function removeFavorite(req: AuthenticatedRequest, res: Response): Promise<void> {
  const favorite = await Favorite.findOneAndDelete({
    userId: req.user!._id,
    policyId: req.params.policyId,
  });

  if (!favorite) {
    throw new AppError(404, 'Favorite not found');
  }

  res.status(200).json(successResponse('Policy removed from favorites'));
}
