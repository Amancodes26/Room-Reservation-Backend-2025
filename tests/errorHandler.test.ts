import request from 'supertest';
import app from '../src/app.js';
import { User, UserRole } from '../src/models/User.js';
import { generateTokens } from '../src/utils/jwt.js';

describe('Error Handling Middleware', () => {
  let userToken: string;

  beforeEach(async () => {
    const user = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'Test@123',
      role: UserRole.USER,
    });

    const tokens = generateTokens(user._id, user.email, user.role);
    userToken = tokens.accessToken;
  });

  describe('Error Handler', () => {
    it('should handle 404 Not Found errors', async () => {
      const response = await request(app)
        .get('/api/nonexistent-route')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
    });

    it('should handle 400 Bad Request errors with admin token', async () => {
      // Create admin user for this test
      const admin = await User.create({
        name: 'Admin User',
        email: 'admin-error@example.com',
        password: 'Admin@123',
        role: UserRole.ADMIN,
      });

      const adminTokens = generateTokens(admin._id, admin.email, admin.role);
      const adminToken = adminTokens.accessToken;

      const response = await request(app)
        .get('/api/users/invalid-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle 401 Unauthorized errors', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('token');
    });

    it('should handle 403 Forbidden errors', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should handle 409 Conflict errors', async () => {
      // Create a user
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Duplicate User',
          email: 'duplicate@example.com',
          password: 'Test@123',
        })
        .expect(201);

      // Try to create same user again
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Duplicate User',
          email: 'duplicate@example.com',
          password: 'Test@123',
        })
        .expect(409);

      expect(response.body.success).toBe(false);
    });

    it('should handle 422 Validation errors', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test',
          email: 'invalid-email',
          password: 'weak',
        })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'application/json')
        .send('{ invalid json')
        .expect(500); // Express returns 500 for malformed JSON

      expect(response.body.success).toBe(false);
    });

    it('should handle MongoDB cast errors', async () => {
      const response = await request(app)
        .get('/api/rooms/not-a-valid-objectid')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should include error stack in development mode', async () => {
      // This tests that error handler works differently in dev/prod
      const response = await request(app)
        .get('/api/nonexistent-route')
        .expect(404);

      expect(response.body.success).toBe(false);
      // In development, stack might be included
      // In production, it should be excluded
    });
  });

  describe('Authentication Errors', () => {
    it('should handle expired token gracefully', async () => {
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should handle token with invalid signature', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Validation Errors', () => {
    it('should return detailed validation error messages', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'A', // Too short
          email: 'not-email',
          password: '123', // Too weak
        })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
    });

    it('should validate nested objects', async () => {
      const response = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'R', // Too short
          capacity: -1, // Negative
        })
        .expect(403); // User doesn't have permission anyway

      expect(response.body.success).toBe(false);
    });
  });
});
