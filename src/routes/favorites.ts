import { Router } from 'express';
import { asyncHandler } from '../controllers/authController';
import {
  addFavorite,
  listFavorites,
  removeFavorite,
} from '../controllers/favoritesController';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import {
  addFavoriteValidators,
  favoritePolicyIdValidator,
} from '../validators/discoveryValidators';

export const favoritesRouter = Router();

favoritesRouter.use(authenticate);

favoritesRouter.get('/', asyncHandler(listFavorites));
favoritesRouter.post('/', validate(addFavoriteValidators), asyncHandler(addFavorite));
favoritesRouter.delete(
  '/:policyId',
  validate([favoritePolicyIdValidator]),
  asyncHandler(removeFavorite)
);
