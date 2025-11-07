import type { Request, Response } from 'express';
import { Reservation, ReservationStatus } from '../models/Reservation.js';
import { Room } from '../models/Room.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
  ConflictError,
} from '../utils/ApiError.js';
import { parsePagination, createPaginationMeta } from '../utils/pagination.js';
import mongoose from 'mongoose';
import { UserRole } from '../models/User.js';

/**
 * Calculate total price based on room price and duration
 */
const calculateTotalPrice = (
  pricePerHour: number,
  startTime: Date,
  endTime: Date
): number => {
  const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
  return Math.ceil(hours) * pricePerHour;
};

/**
 * Check if room is available for the given time slot
 */
const isRoomAvailable = async (
  roomId: string,
  startTime: Date,
  endTime: Date,
  excludeReservationId?: string
): Promise<boolean> => {
  const query: any = {
    room: roomId,
    status: { $in: [ReservationStatus.CONFIRMED, ReservationStatus.PENDING] },
    $or: [
      { startTime: { $lt: endTime, $gte: startTime } },
      { endTime: { $gt: startTime, $lte: endTime } },
      { startTime: { $lte: startTime }, endTime: { $gte: endTime } },
    ],
  };

  if (excludeReservationId) {
    query._id = { $ne: excludeReservationId };
  }

  const conflictingReservation = await Reservation.findOne(query);
  return !conflictingReservation;
};

/**
 * @desc    Create new reservation
 * @route   POST /api/reservations
 * @access  Private
 */
export const createReservation = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { room: roomId, startTime, endTime, purpose, attendees } = req.body;
    const userId = req.user?.userId;

    // Validate dates
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (start >= end) {
      throw new BadRequestError('End time must be after start time');
    }

    if (start < new Date()) {
      throw new BadRequestError('Start time must be in the future');
    }

    // Check if room exists
    const room = await Room.findById(roomId);

    if (!room) {
      throw new NotFoundError('Room not found');
    }

    if (!room.isActive) {
      throw new BadRequestError('Room is not available for booking');
    }

    // Check if attendees exceed room capacity
    if (attendees && attendees > room.capacity) {
      throw new BadRequestError(
        `Number of attendees (${attendees}) exceeds room capacity (${room.capacity})`
      );
    }

    // Check availability
    const available = await isRoomAvailable(roomId, start, end);

    if (!available) {
      throw new ConflictError('Room is not available for the selected time slot');
    }

    // Calculate total price
    const totalPrice = calculateTotalPrice(room.pricePerHour, start, end);

    // Create reservation
    const reservation = await Reservation.create({
      user: userId,
      room: roomId,
      startTime: start,
      endTime: end,
      purpose,
      attendees,
      totalPrice,
      status: ReservationStatus.CONFIRMED,
    });

    // Populate room and user details
    await reservation.populate('room', 'name capacity pricePerHour');
    await reservation.populate('user', 'name email');

    res.status(201).json(
      ApiResponse.success('Reservation created successfully', reservation)
    );
  }
);

/**
 * @desc    Get all reservations (with filters)
 * @route   GET /api/reservations
 * @access  Private
 */
export const getAllReservations = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { page, limit, skip } = parsePagination(
      req.query.page,
      req.query.limit
    );

    const { status, room, startDate, endDate, userId } = req.query;
    const currentUser = req.user;

    // Build query
    const query: any = {};

    // Regular users can only see their own reservations
    if (currentUser?.role === UserRole.USER) {
      query.user = currentUser.userId;
    } else if (userId) {
      // Admins can filter by userId
      query.user = userId;
    }

    if (status) {
      query.status = status;
    }

    if (room) {
      query.room = room;
    }

    if (startDate || endDate) {
      query.startTime = {};
      if (startDate) {
        query.startTime.$gte = new Date(startDate as string);
      }
      if (endDate) {
        query.startTime.$lte = new Date(endDate as string);
      }
    }

    // Execute query
    const [reservations, total] = await Promise.all([
      Reservation.find(query)
        .populate('room', 'name capacity pricePerHour imageUrl')
        .populate('user', 'name email')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Reservation.countDocuments(query),
    ]);

    const meta = createPaginationMeta(page, limit, total);

    res.json(
      ApiResponse.success('Reservations retrieved successfully', reservations, meta)
    );
  }
);

/**
 * @desc    Get reservation by ID
 * @route   GET /api/reservations/:id
 * @access  Private
 */
export const getReservationById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const currentUser = req.user;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestError('Invalid reservation ID');
    }

    const reservation = await Reservation.findById(id)
      .populate('room', 'name capacity pricePerHour imageUrl amenities')
      .populate('user', 'name email');

    if (!reservation) {
      throw new NotFoundError('Reservation not found');
    }

    // Check if user has permission to view this reservation
    if (
      currentUser?.role === UserRole.USER &&
      reservation.user._id.toString() !== currentUser.userId
    ) {
      throw new ForbiddenError('You can only view your own reservations');
    }

    res.json(
      ApiResponse.success('Reservation retrieved successfully', reservation)
    );
  }
);

/**
 * @desc    Update reservation
 * @route   PUT /api/reservations/:id
 * @access  Private
 */
export const updateReservation = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { startTime, endTime, purpose, attendees, status } = req.body;
    const currentUser = req.user;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestError('Invalid reservation ID');
    }

    const reservation = await Reservation.findById(id).populate('room');

    if (!reservation) {
      throw new NotFoundError('Reservation not found');
    }

    // Check permissions
    const isOwner = reservation.user.toString() === currentUser?.userId;
    const isAdmin = currentUser?.role === UserRole.ADMIN;

    if (!isOwner && !isAdmin) {
      throw new ForbiddenError('You can only update your own reservations');
    }

    // Regular users cannot update past reservations
    if (!isAdmin && reservation.startTime < new Date()) {
      throw new BadRequestError('Cannot update past reservations');
    }

    // If updating time, check availability
    if (startTime || endTime) {
      const newStartTime = startTime ? new Date(startTime) : reservation.startTime;
      const newEndTime = endTime ? new Date(endTime) : reservation.endTime;

      if (newStartTime >= newEndTime) {
        throw new BadRequestError('End time must be after start time');
      }

      const available = await isRoomAvailable(
        reservation.room._id.toString(),
        newStartTime,
        newEndTime,
        id
      );

      if (!available) {
        throw new ConflictError('Room is not available for the selected time slot');
      }

      // Recalculate price
      const room = reservation.room as any;
      reservation.totalPrice = calculateTotalPrice(
        room.pricePerHour,
        newStartTime,
        newEndTime
      );
      reservation.startTime = newStartTime;
      reservation.endTime = newEndTime;
    }

    if (purpose !== undefined) reservation.purpose = purpose;
    if (attendees !== undefined) {
      const room = reservation.room as any;
      if (attendees > room.capacity) {
        throw new BadRequestError(
          `Number of attendees (${attendees}) exceeds room capacity (${room.capacity})`
        );
      }
      reservation.attendees = attendees;
    }

    // Only admins can change status
    if (status !== undefined) {
      if (!isAdmin) {
        throw new ForbiddenError('Only admins can change reservation status');
      }
      reservation.status = status;
    }

    await reservation.save();
    await reservation.populate('user', 'name email');

    res.json(
      ApiResponse.success('Reservation updated successfully', reservation)
    );
  }
);

/**
 * @desc    Cancel reservation
 * @route   DELETE /api/reservations/:id
 * @access  Private
 */
export const cancelReservation = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const currentUser = req.user;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestError('Invalid reservation ID');
    }

    const reservation = await Reservation.findById(id);

    if (!reservation) {
      throw new NotFoundError('Reservation not found');
    }

    // Check permissions
    const isOwner = reservation.user.toString() === currentUser?.userId;
    const isAdmin = currentUser?.role === UserRole.ADMIN;

    if (!isOwner && !isAdmin) {
      throw new ForbiddenError('You can only cancel your own reservations');
    }

    // Check if already cancelled
    if (reservation.status === ReservationStatus.CANCELLED) {
      throw new BadRequestError('Reservation is already cancelled');
    }

    // Update status to cancelled
    reservation.status = ReservationStatus.CANCELLED;
    await reservation.save();

    res.json(ApiResponse.success('Reservation cancelled successfully'));
  }
);

/**
 * @desc    Get my reservations
 * @route   GET /api/reservations/my
 * @access  Private
 */
export const getMyReservations = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { page, limit, skip } = parsePagination(
      req.query.page,
      req.query.limit
    );

    const { status } = req.query;
    const userId = req.user?.userId;

    // Build query
    const query: any = { user: userId };

    if (status) {
      query.status = status;
    }

    // Execute query
    const [reservations, total] = await Promise.all([
      Reservation.find(query)
        .populate('room', 'name capacity pricePerHour imageUrl')
        .skip(skip)
        .limit(limit)
        .sort({ startTime: -1 }),
      Reservation.countDocuments(query),
    ]);

    const meta = createPaginationMeta(page, limit, total);

    res.json(
      ApiResponse.success('Your reservations retrieved successfully', reservations, meta)
    );
  }
);
