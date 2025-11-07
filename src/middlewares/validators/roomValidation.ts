import Joi from 'joi';

export const createRoomSchema = Joi.object({
  name: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Room name must be at least 2 characters',
    'string.max': 'Room name cannot exceed 100 characters',
    'any.required': 'Room name is required',
  }),
  description: Joi.string().max(500).required().messages({
    'string.max': 'Description cannot exceed 500 characters',
    'any.required': 'Room description is required',
  }),
  capacity: Joi.number().integer().min(1).max(1000).required().messages({
    'number.min': 'Capacity must be at least 1',
    'number.max': 'Capacity cannot exceed 1000',
    'any.required': 'Room capacity is required',
  }),
  pricePerHour: Joi.number().min(0).required().messages({
    'number.min': 'Price cannot be negative',
    'any.required': 'Price per hour is required',
  }),
  amenities: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        icon: Joi.string().optional(),
      })
    )
    .optional(),
  imageUrl: Joi.string().uri().optional().allow(null, '').messages({
    'string.uri': 'Image URL must be a valid URL',
  }),
  floor: Joi.number().integer().min(0).optional().messages({
    'number.min': 'Floor cannot be negative',
  }),
  building: Joi.string().max(50).optional().messages({
    'string.max': 'Building name cannot exceed 50 characters',
  }),
  isActive: Joi.boolean().optional(),
});

export const updateRoomSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional().messages({
    'string.min': 'Room name must be at least 2 characters',
    'string.max': 'Room name cannot exceed 100 characters',
  }),
  description: Joi.string().max(500).optional().messages({
    'string.max': 'Description cannot exceed 500 characters',
  }),
  capacity: Joi.number().integer().min(1).max(1000).optional().messages({
    'number.min': 'Capacity must be at least 1',
    'number.max': 'Capacity cannot exceed 1000',
  }),
  pricePerHour: Joi.number().min(0).optional().messages({
    'number.min': 'Price cannot be negative',
  }),
  amenities: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        icon: Joi.string().optional(),
      })
    )
    .optional(),
  imageUrl: Joi.string().uri().optional().allow(null, '').messages({
    'string.uri': 'Image URL must be a valid URL',
  }),
  floor: Joi.number().integer().min(0).optional().messages({
    'number.min': 'Floor cannot be negative',
  }),
  building: Joi.string().max(50).optional().messages({
    'string.max': 'Building name cannot exceed 50 characters',
  }),
  isActive: Joi.boolean().optional(),
}).min(1); // At least one field must be provided
