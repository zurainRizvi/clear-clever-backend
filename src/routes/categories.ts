import { Router } from 'express';
import { listCategories } from '../controllers/categoriesController';

export const categoriesRouter = Router();

categoriesRouter.get('/', listCategories);
