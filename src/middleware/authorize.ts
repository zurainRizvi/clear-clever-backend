import type { NextFunction, Response } from 'express';
import type { UserRole } from '../constants/roles';
import { AppError } from '../utils/apiResponse';
import type { AuthenticatedRequest } from './authenticate';

export function authorize(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError(401, 'Authentication required'));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(new AppError(403, 'You do not have permission to access this resource'));
      return;
    }

    next();
  };
}
