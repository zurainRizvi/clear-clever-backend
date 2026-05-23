import type { Request, Response } from 'express';
import { CATEGORIES } from '../constants/categories';
import { successResponse } from '../utils/apiResponse';

export function listCategories(_req: Request, res: Response): void {
  res.status(200).json(
    successResponse('Categories retrieved', {
      categories: CATEGORIES.map(({ slug, name, available }) => ({ slug, name, available })),
    })
  );
}
