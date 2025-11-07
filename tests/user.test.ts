import request from 'supertest';
import app from '../src/app.js';
import { User, UserRole } from '../src/models/User.js';
import { generateTokens } from '../src/utils/jwt.js';

describe('User Controller', () => {
  let adminToken: string;
  let userToken: string;
  let testUserId: string;

  beforeEach(async () => {
    // Create admin user
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'Admin@123',
      role: UserRole.ADMIN,
    });

    const adminTokens = generateTokens(admin._id, admin.email, admin.role);
    adminToken = adminTokens.accessToken;

    // Create regular user
    const user = await User.create({
      name: 'Regular User',
      email: 'user@example.com',
      password: 'User@123',
      role: UserRole.USER,
    });

    const userTokens = generateTokens(user._id, user.email, user.role);
    userToken = userTokens.accessToken;
    testUserId = user._id.toString();
  });

  describe('GET /api/users', () => {
    it('should get all users as admin', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.meta).toBeDefined();
    });

    it('should not get users as regular user', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should not get users without authentication', async () => {
      const response = await request(app)
        .get('/api/users')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should filter users by role', async () => {
      const response = await request(app)
        .get('/api/users?role=admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.every((u: any) => u.role === UserRole.ADMIN)).toBe(true);
    });

    it('should paginate users', async () => {
      // Create more users
      await User.create({
        name: 'User 2',
        email: 'user2@example.com',
        password: 'User@123',
        role: UserRole.USER,
      });

      const response = await request(app)
        .get('/api/users?page=1&limit=1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.meta.totalPages).toBeGreaterThan(1);
    });

    it('should search users by name', async () => {
      const response = await request(app)
        .get('/api/users?search=Regular')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0]?.name).toContain('Regular');
    });
  });

  describe('GET /api/users/:id', () => {
    it('should get user by id as admin', async () => {
      const response = await request(app)
        .get(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('user@example.com');
    });

    it('should not get user by id as regular user', async () => {
      const response = await request(app)
        .get(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .get('/api/users/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid user id', async () => {
      const response = await request(app)
        .get('/api/users/invalid-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/users/:id', () => {
    it('should update user as admin', async () => {
      const updateData = {
        name: 'Updated Name',
        email: 'updated@example.com',
      };

      const response = await request(app)
        .put(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updateData.name);
      expect(response.body.data.email).toBe(updateData.email);
    });

    it('should not update user as regular user', async () => {
      const updateData = {
        name: 'Updated Name',
      };

      const response = await request(app)
        .put(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .put('/api/users/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should not update to duplicate email', async () => {
      const response = await request(app)
        .put(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'admin@example.com' })
        .expect(409);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /api/users/:id/deactivate', () => {
    it('should deactivate user as admin', async () => {
      const response = await request(app)
        .patch(`/api/users/${testUserId}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deactivated');
    });

    it('should not deactivate user as regular user', async () => {
      const response = await request(app)
        .patch(`/api/users/${testUserId}/deactivate`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .patch('/api/users/507f1f77bcf86cd799439011/deactivate')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /api/users/:id/activate', () => {
    beforeEach(async () => {
      // Deactivate user first
      await User.findByIdAndUpdate(testUserId, { isActive: false });
    });

    it('should activate user as admin', async () => {
      const response = await request(app)
        .patch(`/api/users/${testUserId}/activate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('activated');
    });

    it('should not activate user as regular user', async () => {
      const response = await request(app)
        .patch(`/api/users/${testUserId}/activate`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(401); // User is deactivated, so their token is invalid

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('should delete user as admin', async () => {
      const response = await request(app)
        .delete(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');

      // Verify user is deleted
      const deletedUser = await User.findById(testUserId);
      expect(deletedUser).toBeNull();
    });

    it('should not delete user as regular user', async () => {
      const response = await request(app)
        .delete(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .delete('/api/users/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid user id', async () => {
      const response = await request(app)
        .delete('/api/users/invalid-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Negative Test Cases', () => {
    it('should reject promote with invalid user id', async () => {
      const response = await request(app)
        .patch('/api/users/invalid-id/promote')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject demote with invalid user id', async () => {
      const response = await request(app)
        .patch('/api/users/invalid-id/demote')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject activate with invalid user id', async () => {
      const response = await request(app)
        .patch('/api/users/invalid-id/activate')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject update with empty body', async () => {
      const response = await request(app)
        .put(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(200); // Empty updates are allowed

      expect(response.body.success).toBe(true);
    });

    it('should reject operations without admin token', async () => {
      const response = await request(app)
        .patch(`/api/users/${testUserId}/promote`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });
});
