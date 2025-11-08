import { Router } from 'express';
import {
  register,
  login,
  refreshToken,
  getMe,
  requestPasswordReset,
  resetPassword,
} from '../controllers/authController';
import { authenticate } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  resetPasswordRequestSchema,
  resetPasswordSchema,
} from '../middlewares/validators/authValidation';

const router = Router();

// Public routes
router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/refresh', validate(refreshTokenSchema), refreshToken);
router.post(
  '/reset-password-request',
  validate(resetPasswordRequestSchema),
  requestPasswordReset
);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);

// Protected routes
router.get('/me', authenticate, getMe);

export default router;
