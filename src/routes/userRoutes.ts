import { Router } from 'express';
import {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  deactivateUser,
  activateUser,
  promoteToAdmin,
  demoteToUser,
} from '../controllers/userController.js';
import { authenticate } from '../middlewares/auth.js';
import { authorize } from '../middlewares/authorize.js';
import { UserRole } from '../models/User.js';
import { validate } from '../middlewares/validate.js';
import { updateUserSchema } from '../middlewares/validators/authValidation.js';

const router = Router();

// All user routes require authentication and admin role
router.use(authenticate, authorize(UserRole.ADMIN));

router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.put('/:id', validate(updateUserSchema), updateUser);
router.delete('/:id', deleteUser);
router.patch('/:id/deactivate', deactivateUser);
router.patch('/:id/activate', activateUser);
router.patch('/:id/promote', promoteToAdmin);
router.patch('/:id/demote', demoteToUser);

export default router;
