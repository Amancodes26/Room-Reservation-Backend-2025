import Joi from 'joi';

export const createReservationSchema = Joi.object({
  room: Joi.string().hex().length(24).required().messages({
    'string.hex': 'Invalid room ID format',
    'string.length': 'Invalid room ID format',
    'any.required': 'Room ID is required',
  }),
  startTime: Joi.date().iso().greater('now').required().messages({
    'date.greater': 'Start time must be in the future',
    'any.required': 'Start time is required',
  }),
  endTime: Joi.date().iso().greater(Joi.ref('startTime')).required().messages({
    'date.greater': 'End time must be after start time',
    'any.required': 'End time is required',
  }),
  purpose: Joi.string().max(200).optional().messages({
    'string.max': 'Purpose cannot exceed 200 characters',
  }),
  attendees: Joi.number().integer().min(1).optional().messages({
    'number.min': 'Attendees must be at least 1',
  }),
});

export const updateReservationSchema = Joi.object({
  startTime: Joi.date().iso().greater('now').optional().messages({
    'date.greater': 'Start time must be in the future',
  }),
  endTime: Joi.date().iso().optional(),
  purpose: Joi.string().max(200).optional().messages({
    'string.max': 'Purpose cannot exceed 200 characters',
  }),
  attendees: Joi.number().integer().min(1).optional().messages({
    'number.min': 'Attendees must be at least 1',
  }),
  status: Joi.string()
    .valid('pending', 'confirmed', 'cancelled', 'completed')
    .optional(),
}).min(1); // At least one field must be provided
