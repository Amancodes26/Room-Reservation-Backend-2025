import { Router } from 'express';
import {
  createReservation,
  getAllReservations,
  getReservationById,
  updateReservation,
  cancelReservation,
  getMyReservations,
} from '../controllers/reservationController';
import { authenticate } from '../middlewares/auth';
import { authorize } from '../middlewares/authorize';
import { UserRole } from '../models/User';
import { validate } from '../middlewares/validate';
import {
  createReservationSchema,
  updateReservationSchema,
} from '../middlewares/validators/reservationValidation';

const router = Router();

// All reservation routes require authentication
router.use(authenticate);

// User routes
router.get('/my', getMyReservations);
router.post('/', validate(createReservationSchema), createReservation);

// Admin only route - get all reservations
router.get('/', authorize(UserRole.ADMIN), getAllReservations);

// Shared routes
router.get('/:id', getReservationById);
router.put('/:id', validate(updateReservationSchema), updateReservation);
router.delete('/:id', cancelReservation);

export default router;
