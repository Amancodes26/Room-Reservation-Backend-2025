import { Router } from 'express';
import {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  activateUser,
  deactivateUser,
  promoteToAdmin,
  demoteToUser,
} from '../controllers/userController';
import { authenticate } from '../middlewares/auth';
import { authorize } from '../middlewares/authorize';
import { UserRole } from '../models/User';
import { validate } from '../middlewares/validate';
import { updateUserSchema } from '../middlewares/validators/authValidation';

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
