import request from 'supertest';
import app from '../src/app';
import { User, UserRole } from '../src/models/User';
import { generateTokens } from '../src/utils/jwt';
import crypto from 'crypto';

describe('Auth Controller', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Test@123',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });

    it('should not register with invalid email', async () => {
      const userData = {
        name: 'John Doe',
        email: 'invalid-email',
        password: 'Test@123',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(422);

      expect(response.body.success).toBe(false);
    });

    it('should not register with weak password', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'weak',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(422);

      expect(response.body.success).toBe(false);
    });

    it('should not register duplicate email', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Test@123',
      };

      await request(app).post('/api/auth/register').send(userData);

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(409);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Test@123',
        role: UserRole.USER,
      });
    });

    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Test@123',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.user.email).toBe('test@example.com');
    });

    it('should not login with wrong password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPass@123',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should not login with non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Test@123',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/me', () => {
    let authToken: string;

    beforeEach(async () => {
      const user = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Test@123',
        role: UserRole.USER,
      });

      const tokens = generateTokens(user._id, user.email, user.role);
      authToken = tokens.accessToken;
    });

    it('should get current user profile', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('test@example.com');
    });

    it('should not get profile without token', async () => {
      const response = await request(app).get('/api/auth/me').expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should not get profile with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/reset-password-request', () => {
    beforeEach(async () => {
      await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Test@123',
        role: UserRole.USER,
      });
    });

    it('should request password reset successfully', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password-request')
        .send({ email: 'test@example.com' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Password reset token generated');

      // Verify reset token was created in database
      const user = await User.findOne({ email: 'test@example.com' });
      expect(user?.resetPasswordToken).toBeDefined();
      expect(user?.resetPasswordExpire).toBeDefined();
    });

    it('should handle non-existent email gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password-request')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      // For security, should return success even for non-existent email
      expect(response.body.success).toBe(true);
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password-request')
        .send({ email: 'invalid-email' })
        .expect(422);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/reset-password', () => {
    let resetToken: string;
    let hashedToken: string;

    beforeEach(async () => {
      // Generate reset token
      resetToken = crypto.randomBytes(32).toString('hex');
      hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

      // Create user with reset token
      await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: 'OldPassword@123',
        role: UserRole.USER,
        resetPasswordToken: hashedToken,
        resetPasswordExpire: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      });
    });

    it('should reset password successfully with valid token', async () => {
      const newPassword = 'NewPassword@123';

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          password: newPassword,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Password reset successful');

      // Verify user can login with new password
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: newPassword,
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);

      // Verify reset token was cleared
      const user = await User.findOne({ email: 'test@example.com' });
      expect(user?.resetPasswordToken).toBeUndefined();
      expect(user?.resetPasswordExpire).toBeUndefined();
    });

    it('should reject expired reset token', async () => {
      // Create user with expired token
      const expiredToken = crypto.randomBytes(32).toString('hex');
      const expiredHashedToken = crypto.createHash('sha256').update(expiredToken).digest('hex');

      await User.create({
        name: 'Expired User',
        email: 'expired@example.com',
        password: 'Password@123',
        role: UserRole.USER,
        resetPasswordToken: expiredHashedToken,
        resetPasswordExpire: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      });

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: expiredToken,
          password: 'NewPassword@123',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('expired');
    });

    it('should reject invalid reset token', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'invalid-token-12345',
          password: 'NewPassword@123',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate new password strength', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          password: 'weak',
        })
        .expect(422);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      const user = await User.create({
        name: 'Test User',
        email: 'refresh@example.com',
        password: 'Test@123',
        role: UserRole.USER,
      });

      const tokens = generateTokens(user._id, user.email, user.role);
      refreshToken = tokens.refreshToken;
    });

    it('should refresh token successfully', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(500); // JWT verification throws 500 for invalid tokens

      expect(response.body.success).toBe(false);
    });

    it('should reject missing refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect(422);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Negative Test Cases', () => {
    it('should reject registration with missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com' })
        .expect(422);

      expect(response.body.success).toBe(false);
    });

    it('should reject login with missing password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' })
        .expect(422);

      expect(response.body.success).toBe(false);
    });

    it('should reject password reset with invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password-request')
        .send({ email: 'not-an-email' })
        .expect(422);

      expect(response.body.success).toBe(false);
    });

    it('should reject accessing protected route without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject malformed Bearer token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'NotBearer token123')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});
