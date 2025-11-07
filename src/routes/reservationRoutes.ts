import { Router } from 'express';
import {
  createReservation,
  getAllReservations,
  getReservationById,
  updateReservation,
  cancelReservation,
  getMyReservations,
} from '../controllers/reservationController.js';
import { authenticate } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  createReservationSchema,
  updateReservationSchema,
} from '../middlewares/validators/reservationValidation.js';

const router = Router();

// All reservation routes require authentication
router.use(authenticate);

// User routes
router.get('/my', getMyReservations);
router.post('/', validate(createReservationSchema), createReservation);
router.get('/', getAllReservations);
router.get('/:id', getReservationById);
router.put('/:id', validate(updateReservationSchema), updateReservation);
router.delete('/:id', cancelReservation);

export default router;
