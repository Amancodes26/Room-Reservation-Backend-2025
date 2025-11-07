import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import mongoose from 'mongoose';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

/**
 * Generate access token
 */
export const generateAccessToken = (payload: JWTPayload): string => {
  const options: jwt.SignOptions = {
    expiresIn: env.jwtExpire as any,
  };
  return jwt.sign(payload, env.jwtSecret, options);
};

/**
 * Generate refresh token
 */
export const generateRefreshToken = (payload: JWTPayload): string => {
  const options: jwt.SignOptions = {
    expiresIn: env.jwtRefreshExpire as any,
  };
  return jwt.sign(payload, env.jwtRefreshSecret, options);
};

/**
 * Verify access token
 */
export const verifyAccessToken = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, env.jwtSecret) as JWTPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

/**
 * Verify refresh token
 */
export const verifyRefreshToken = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, env.jwtRefreshSecret) as JWTPayload;
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
};

/**
 * Generate both tokens
 */
export const generateTokens = (userId: mongoose.Types.ObjectId, email: string, role: string) => {
  const payload: JWTPayload = {
    userId: userId.toString(),
    email,
    role,
  };

  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
};
