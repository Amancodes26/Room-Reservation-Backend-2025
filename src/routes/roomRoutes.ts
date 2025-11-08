import { Router } from 'express';
import {
  getAllRooms,
  getRoomById,
  createRoom,
  updateRoom,
  deleteRoom,
  getRoomAvailability,
} from '../controllers/roomController';
import { authenticate } from '../middlewares/auth';
import { authorize } from '../middlewares/authorize';
import { UserRole } from '../models/User';
import { validate } from '../middlewares/validate';
import {
  createRoomSchema,
  updateRoomSchema,
} from '../middlewares/validators/roomValidation';

const router = Router();

// Public routes
router.get('/', getAllRooms);
router.get('/:id', getRoomById);
router.get('/:id/availability', getRoomAvailability);

// Admin only routes
router.post(
  '/',
  authenticate,
  authorize(UserRole.ADMIN),
  validate(createRoomSchema),
  createRoom
);
router.put(
  '/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  validate(updateRoomSchema),
  updateRoom
);
router.delete('/:id', authenticate, authorize(UserRole.ADMIN), deleteRoom);

export default router;
