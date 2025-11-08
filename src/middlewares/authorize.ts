/**
 * Authorization Middleware
 * Checks user roles to authorize access to specific routes
 * Ensures that only users with appropriate roles can access certain resources
 */


import type { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../utils/ApiError';
import { UserRole } from '../models/User';

/**
 * Authorize based on user roles
 */
export const authorize = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!roles.includes(req.user.role as UserRole)) {
      return next(
        new ForbiddenError(
          `Access denied. Required roles: ${roles.join(', ')}`
        )
      );
    }

    next();
  };
};
