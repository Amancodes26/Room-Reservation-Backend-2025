/** User Controller
 * handles user management including retrieval, updating, and deletion
 * supports admin functionalities for user role management
 * provides filtering and pagination for user listings
*/




import type { Request, Response } from 'express';
import { User, UserRole } from '../models/User';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { NotFoundError, BadRequestError } from '../utils/ApiError';
import { parsePagination, createPaginationMeta } from '../utils/pagination';
import mongoose from 'mongoose';

/**
 * @desc    Get all users (Admin only)
 * @route   GET /api/users
 * @access  Private/Admin
 */
export const getAllUsers = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { page, limit, skip } = parsePagination(
      req.query.page,
      req.query.limit
    );

    const { role, isActive, search } = req.query;

    // Build query
    const query: any = {};

    if (role) {
      query.role = role;
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    // Execute query with pagination
    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      User.countDocuments(query),
    ]);

    const meta = createPaginationMeta(page, limit, total);

    res.json(ApiResponse.success('Users retrieved successfully', users, meta));
  }
);

/**
 * @desc    Get user by ID
 * @route   GET /api/users/:id
 * @access  Private/Admin
 */
export const getUserById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestError('Invalid user ID');
    }

    const user = await User.findById(id).select('-password');

    if (!user) {
      throw new NotFoundError('User not found');
    }

    res.json(ApiResponse.success('User retrieved successfully', user));
  }
);

/**
 * @desc    Update user
 * @route   PUT /api/users/:id
 * @access  Private/Admin
 */
export const updateUser = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const updates = req.body;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestError('Invalid user ID');
    }

    // Don't allow password updates through this endpoint
    delete updates.password;

    const user = await User.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    }).select('-password');

    if (!user) {
      throw new NotFoundError('User not found');
    }

    res.json(ApiResponse.success('User updated successfully', user));
  }
);

/**
 * @desc    Delete user
 * @route   DELETE /api/users/:id
 * @access  Private/Admin
 */
export const deleteUser = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestError('Invalid user ID');
    }

    // Prevent admin from deleting themselves
    if (id === req.user?.userId) {
      throw new BadRequestError('You cannot delete your own account');
    }

    const user = await User.findByIdAndDelete(id);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    res.json(ApiResponse.success('User deleted successfully'));
  }
);

/**
 * @desc    Deactivate user account
 * @route   PATCH /api/users/:id/deactivate
 * @access  Private/Admin
 */
export const deactivateUser = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestError('Invalid user ID');
    }

    const user = await User.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    ).select('-password');

    if (!user) {
      throw new NotFoundError('User not found');
    }

    res.json(ApiResponse.success('User deactivated successfully', user));
  }
);

/**
 * @desc    Activate user account
 * @route   PATCH /api/users/:id/activate
 * @access  Private/Admin
 */
export const activateUser = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestError('Invalid user ID');
    }

    const user = await User.findByIdAndUpdate(
      id,
      { isActive: true },
      { new: true }
    ).select('-password');

    if (!user) {
      throw new NotFoundError('User not found');
    }

    res.json(ApiResponse.success('User activated successfully', user));
  }
);

/**
 * @desc    Promote user to admin role
 * @route   PATCH /api/users/:id/promote
 * @access  Private/Admin
 */
export const promoteToAdmin = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestError('Invalid user ID');
    }

    const user = await User.findById(id).select('-password');

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (user.role === UserRole.ADMIN) {
      throw new BadRequestError('User is already an admin');
    }

    user.role = UserRole.ADMIN;
    await user.save();

    res.json(ApiResponse.success('User promoted to admin successfully', user));
  }
);

/**
 * @desc    Demote admin to regular user role
 * @route   PATCH /api/users/:id/demote
 * @access  Private/Admin
 */
export const demoteToUser = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestError('Invalid user ID');
    }

    const user = await User.findById(id).select('-password');

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (user.role === UserRole.USER) {
      throw new BadRequestError('User is already a regular user');
    }

    // Prevent demoting yourself
    if (req.user?.userId === id) {
      throw new BadRequestError('You cannot demote yourself');
    }

    user.role = UserRole.USER;
    await user.save();

    res.json(ApiResponse.success('User demoted to regular user successfully', user));
  }
);
