import type { Request, Response, NextFunction } from 'express';
import type { ObjectSchema } from 'joi';
import { ValidationError } from '../utils/ApiError.js';

/**
 * Validate request data using Joi schema
 */
export const validate = (schema: ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false, // Return all errors
      stripUnknown: true, // Remove unknown fields
    });

    if (error) {
      const errorMessage = error.details
        .map((detail) => detail.message)
        .join(', ');
      return next(new ValidationError(errorMessage));
    }

    // Replace request body with validated value
    req.body = value;
    next();
  };
};
