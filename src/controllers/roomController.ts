/** Room Controller
 * handles room creation, retrieval, updating, and deletion
 * provides room availability information
 * supports filtering and pagination for room listings
*/



import type { Request, Response } from 'express';
import { Room } from '../models/Room';
import { Reservation, ReservationStatus } from '../models/Reservation';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { NotFoundError, BadRequestError } from '../utils/ApiError';
import { parsePagination, createPaginationMeta } from '../utils/pagination';
import mongoose from 'mongoose';

/**
 * @desc    Get all rooms with filters and pagination
 * @route   GET /api/rooms
 * @access  Public
 */
export const getAllRooms = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { page, limit, skip } = parsePagination(
      req.query.page,
      req.query.limit
    );

    const {
      minCapacity,
      maxCapacity,
      minPrice,
      maxPrice,
      amenities,
      search,
      isActive,
      startTime,
      endTime,
    } = req.query;

    // Build query
    const query: any = {};

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    } else {
      query.isActive = true; // Only show active rooms by default
    }

    if (minCapacity) {
      query.capacity = { ...query.capacity, $gte: parseInt(minCapacity as string) };
    }

    if (maxCapacity) {
      query.capacity = { ...query.capacity, $lte: parseInt(maxCapacity as string) };
    }

    if (minPrice) {
      query.pricePerHour = { ...query.pricePerHour, $gte: parseFloat(minPrice as string) };
    }

    if (maxPrice) {
      query.pricePerHour = { ...query.pricePerHour, $lte: parseFloat(maxPrice as string) };
    }

    if (amenities) {
      const amenitiesList = (amenities as string).split(',');
      query['amenities.name'] = { $all: amenitiesList };
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    // Get rooms
    let rooms = await Room.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    // Filter by availability if date range is provided
    if (startTime && endTime) {
      const start = new Date(startTime as string);
      const end = new Date(endTime as string);

      // Find rooms that have conflicting reservations
      const bookedRoomIds = await Reservation.distinct('room', {
        status: { $in: [ReservationStatus.CONFIRMED, ReservationStatus.PENDING] },
        $or: [
          { startTime: { $lt: end, $gte: start } },
          { endTime: { $gt: start, $lte: end } },
          { startTime: { $lte: start }, endTime: { $gte: end } },
        ],
      });

      // Filter out booked rooms
      rooms = rooms.filter(
        (room) => !bookedRoomIds.some((id) => id.toString() === room._id.toString())
      );
    }

    const total = await Room.countDocuments(query);
    const meta = createPaginationMeta(page, limit, total);

    res.json(ApiResponse.success('Rooms retrieved successfully', rooms, meta));
  }
);

/**
 * @desc    Get room by ID
 * @route   GET /api/rooms/:id
 * @access  Public
 */
export const getRoomById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestError('Invalid room ID');
    }

    const room = await Room.findById(id);

    if (!room) {
      throw new NotFoundError('Room not found');
    }

    res.json(ApiResponse.success('Room retrieved successfully', room));
  }
);

/**
 * @desc    Create new room
 * @route   POST /api/rooms
 * @access  Private/Admin
 */
export const createRoom = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const room = await Room.create(req.body);

    res.status(201).json(
      ApiResponse.success('Room created successfully', room)
    );
  }
);

/**
 * @desc    Update room
 * @route   PUT /api/rooms/:id
 * @access  Private/Admin
 */
export const updateRoom = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestError('Invalid room ID');
    }

    const room = await Room.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!room) {
      throw new NotFoundError('Room not found');
    }

    res.json(ApiResponse.success('Room updated successfully', room));
  }
);

/**
 * @desc    Delete room
 * @route   DELETE /api/rooms/:id
 * @access  Private/Admin
 */
export const deleteRoom = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestError('Invalid room ID');
    }

    // Check if room has active reservations
    const activeReservations = await Reservation.countDocuments({
      room: id,
      status: { $in: [ReservationStatus.CONFIRMED, ReservationStatus.PENDING] },
      endTime: { $gt: new Date() },
    });

    if (activeReservations > 0) {
      throw new BadRequestError(
        'Cannot delete room with active or pending reservations'
      );
    }

    const room = await Room.findByIdAndDelete(id);

    if (!room) {
      throw new NotFoundError('Room not found');
    }

    res.json(ApiResponse.success('Room deleted successfully'));
  }
);

/**
 * @desc    Get room availability for a date range
 * @route   GET /api/rooms/:id/availability
 * @access  Public
 */
export const getRoomAvailability = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestError('Invalid room ID');
    }

    if (!startDate || !endDate) {
      throw new BadRequestError('Start date and end date are required');
    }

    const room = await Room.findById(id);

    if (!room) {
      throw new NotFoundError('Room not found');
    }

    // Find all reservations for this room in the date range
    const reservations = await Reservation.find({
      room: id,
      status: { $in: [ReservationStatus.CONFIRMED, ReservationStatus.PENDING] },
      startTime: { $lt: new Date(endDate as string) },
      endTime: { $gt: new Date(startDate as string) },
    }).sort({ startTime: 1 });

    res.json(
      ApiResponse.success('Room availability retrieved', {
        room: {
          id: room._id,
          name: room.name,
        },
        dateRange: {
          start: startDate,
          end: endDate,
        },
        bookedSlots: reservations.map((r) => ({
          startTime: r.startTime,
          endTime: r.endTime,
          status: r.status,
        })),
      })
    );
  }
);
