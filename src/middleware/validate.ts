import type { NextFunction, Request, Response } from 'express';
import { validationResult, type ValidationChain } from 'express-validator';
import { errorResponse } from '../utils/apiResponse';

/**
 * Runs express-validator chains, then returns 400 with field errors if invalid.
 */
export function validate(chains: ValidationChain[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await Promise.all(chains.map((chain) => chain.run(req)));

    const result = validationResult(req);
    if (result.isEmpty()) {
      next();
      return;
    }

    const errors = result.array().map((item) => {
      if (item.type === 'field') {
        return `${item.path}: ${item.msg}`;
      }
      return item.msg;
    });

    res.status(400).json(errorResponse('Validation failed', errors));
  };
}
