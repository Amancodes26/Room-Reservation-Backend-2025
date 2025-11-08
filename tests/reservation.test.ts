import request from 'supertest';
import app from '../src/app';
import { User, UserRole } from '../src/models/User';
import { Room } from '../src/models/Room';
import { Reservation } from '../src/models/Reservation';
import { generateTokens } from '../src/utils/jwt';

describe('Reservation Controller', () => {
  let userToken: string;
  let userId: string;
  let roomId: string;

  beforeEach(async () => {
    // Create user
    const user = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'Test@123',
      role: UserRole.USER,
    });
    userId = user._id.toString();
    const tokens = generateTokens(user._id, user.email, user.role);
    userToken = tokens.accessToken;

    // Create room
    const room = await Room.create({
      name: 'Test Room',
      description: 'Test description',
      capacity: 10,
      pricePerHour: 30,
      isActive: true,
    });
    roomId = room._id.toString();
  });

  describe('POST /api/reservations', () => {
    it('should create reservation successfully', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);

      const endTime = new Date(tomorrow);
      endTime.setHours(12, 0, 0, 0);

      const reservationData = {
        room: roomId,
        startTime: tomorrow.toISOString(),
        endTime: endTime.toISOString(),
        purpose: 'Team meeting',
        attendees: 5,
      };

      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${userToken}`)
        .send(reservationData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.room._id).toBe(roomId);
      expect(response.body.data.totalPrice).toBe(60); // 2 hours * 30
    });

    it('should not create reservation without authentication', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const reservationData = {
        room: roomId,
        startTime: tomorrow.toISOString(),
        endTime: new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      };

      await request(app)
        .post('/api/reservations')
        .send(reservationData)
        .expect(401);
    });

    it('should not create reservation with past date', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const reservationData = {
        room: roomId,
        startTime: yesterday.toISOString(),
        endTime: new Date(yesterday.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      };

      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${userToken}`)
        .send(reservationData)
        .expect(422);

      expect(response.body.success).toBe(false);
    });

    it('should not create overlapping reservation', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);

      const endTime = new Date(tomorrow);
      endTime.setHours(12, 0, 0, 0);

      // Create first reservation
      await Reservation.create({
        user: userId,
        room: roomId,
        startTime: tomorrow,
        endTime: endTime,
        totalPrice: 60,
      });

      // Try to create overlapping reservation
      const overlappingStart = new Date(tomorrow);
      overlappingStart.setHours(11, 0, 0, 0);

      const overlappingEnd = new Date(tomorrow);
      overlappingEnd.setHours(13, 0, 0, 0);

      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          room: roomId,
          startTime: overlappingStart.toISOString(),
          endTime: overlappingEnd.toISOString(),
        })
        .expect(409);

      expect(response.body.success).toBe(false);
    });

    it('should not allow attendees exceeding room capacity', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);

      const endTime = new Date(tomorrow);
      endTime.setHours(12, 0, 0, 0);

      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          room: roomId,
          startTime: tomorrow.toISOString(),
          endTime: endTime.toISOString(),
          attendees: 100, // Exceeds capacity of 10
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/reservations/my', () => {
    beforeEach(async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      await Reservation.create({
        user: userId,
        room: roomId,
        startTime: tomorrow,
        endTime: new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000),
        totalPrice: 60,
      });
    });

    it('should get user reservations', async () => {
      const response = await request(app)
        .get('/api/reservations/my')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.meta).toBeDefined();
    });

    it('should not get reservations without authentication', async () => {
      await request(app).get('/api/reservations/my').expect(401);
    });
  });

  describe('DELETE /api/reservations/:id (Cancel)', () => {
    let reservationId: string;

    beforeEach(async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const reservation = await Reservation.create({
        user: userId,
        room: roomId,
        startTime: tomorrow,
        endTime: new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000),
        totalPrice: 60,
      });
      reservationId = reservation._id.toString();
    });

    it('should cancel own reservation', async () => {
      const response = await request(app)
        .delete(`/api/reservations/${reservationId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify reservation is cancelled
      const cancelledReservation = await Reservation.findById(reservationId);
      expect(cancelledReservation?.status).toBe('cancelled');
    });

    it('should not cancel other user reservation', async () => {
      // Create another user
      const otherUser = await User.create({
        name: 'Other User',
        email: 'other@example.com',
        password: 'Other@123',
        role: UserRole.USER,
      });
      const otherTokens = generateTokens(
        otherUser._id,
        otherUser.email,
        otherUser.role
      );

      const response = await request(app)
        .delete(`/api/reservations/${reservationId}`)
        .set('Authorization', `Bearer ${otherTokens.accessToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/reservations (Admin)', () => {
    let adminToken: string;

    beforeEach(async () => {
      // Create admin user
      const admin = await User.create({
        name: 'Admin',
        email: 'admin2@example.com',
        password: 'Admin@123',
        role: UserRole.ADMIN,
      });

      const tokens = generateTokens(admin._id, admin.email, admin.role);
      adminToken = tokens.accessToken;
    });

    it('should get all reservations as admin', async () => {
      const response = await request(app)
        .get('/api/reservations')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should filter reservations by status', async () => {
      const response = await request(app)
        .get('/api/reservations?status=confirmed')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should not get all reservations as regular user', async () => {
      const response = await request(app)
        .get('/api/reservations')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/reservations/:id', () => {
    let reservationId: string;

    beforeEach(async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 7);
      const dayAfter = new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000);

      const reservation = await Reservation.create({
        user: userId,
        room: roomId,
        startTime: tomorrow,
        endTime: dayAfter,
        totalPrice: 60,
      });
      reservationId = reservation._id.toString();
    });

    it('should get reservation by id', async () => {
      const response = await request(app)
        .get(`/api/reservations/${reservationId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data._id).toBe(reservationId);
    });

    it('should return 404 for non-existent reservation', async () => {
      const response = await request(app)
        .get('/api/reservations/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid reservation id', async () => {
      const response = await request(app)
        .get('/api/reservations/invalid-id')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    let testRoomId: string;
    let testUserId: string;  

    beforeEach(async () => {
      // Use the room and user created in the parent beforeEach
      testUserId = userId;
      testRoomId = roomId;
    });

    it('should prevent booking with end time before start time', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          room: testRoomId,
          startTime: tomorrow.toISOString(),
          endTime: yesterday.toISOString(),
          numberOfAttendees: 5,
          purpose: 'Meeting',
        })
        .expect(422);

      expect(response.body.success).toBe(false);
    });

    it('should prevent booking in the past', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          room: testRoomId,
          startTime: twoDaysAgo.toISOString(),
          endTime: yesterday.toISOString(),
          numberOfAttendees: 5,
          purpose: 'Meeting',
        })
        .expect(422);

      expect(response.body.success).toBe(false);
    });

    it('should prevent booking with same start and end time', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          room: testRoomId,
          startTime: tomorrow.toISOString(),
          endTime: tomorrow.toISOString(),
          numberOfAttendees: 5,
          purpose: 'Meeting',
        })
        .expect(422);

      expect(response.body.success).toBe(false);
    });

    it('should prevent overlapping reservations', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      const tomorrowEnd = new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000); // 12:00

      // Create first reservation
      await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          room: testRoomId,
          startTime: tomorrow.toISOString(),
          endTime: tomorrowEnd.toISOString(),
          numberOfAttendees: 5,
          purpose: 'Meeting 1',
        })
        .expect(201);

      // Try to create overlapping reservation
      const overlapStart = new Date(tomorrow.getTime() + 1 * 60 * 60 * 1000); // 11:00
      const overlapEnd = new Date(tomorrow.getTime() + 3 * 60 * 60 * 1000); // 13:00

      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          room: testRoomId,
          startTime: overlapStart.toISOString(),
          endTime: overlapEnd.toISOString(),
          numberOfAttendees: 5,
          purpose: 'Meeting 2',
        })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not available');
    });

    it('should allow back-to-back reservations', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      const firstEnd = new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000); // 12:00

      // Create first reservation
      await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          room: testRoomId,
          startTime: tomorrow.toISOString(),
          endTime: firstEnd.toISOString(),
          numberOfAttendees: 5,
          purpose: 'Meeting 1',
        })
        .expect(201);

      // Create back-to-back reservation (starts when first ends)
      const secondEnd = new Date(firstEnd.getTime() + 2 * 60 * 60 * 1000); // 14:00

      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          room: testRoomId,
          startTime: firstEnd.toISOString(),
          endTime: secondEnd.toISOString(),
          numberOfAttendees: 5,
          purpose: 'Meeting 2',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should not allow cancelling another user\'s reservation', async () => {
      // Create reservation as first user
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000);

      const createResponse = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          room: testRoomId,
          startTime: tomorrow.toISOString(),
          endTime: dayAfter.toISOString(),
          numberOfAttendees: 5,
          purpose: 'Meeting',
        })
        .expect(201);

      const reservationId = createResponse.body.data._id;

      // Create another user
      const otherUser = await User.create({
        name: 'Other User',
        email: 'other@example.com',
        password: 'Test@123',
        role: UserRole.USER,
      });
      const otherTokens = generateTokens(otherUser._id, otherUser.email, otherUser.role);
      const otherToken = otherTokens.accessToken;

      // Try to cancel with different user
      const response = await request(app)
        .delete(`/api/reservations/${reservationId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Negative Test Cases', () => {
    it('should reject reservation with invalid room id', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000);

      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          room: 'invalid-id',
          startTime: tomorrow.toISOString(),
          endTime: dayAfter.toISOString(),
          numberOfAttendees: 5,
          purpose: 'Meeting',
        })
        .expect(422);

      expect(response.body.success).toBe(false);
    });

    it('should reject reservation with non-existent room', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000);

      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          room: '507f1f77bcf86cd799439011',
          startTime: tomorrow.toISOString(),
          endTime: dayAfter.toISOString(),
          numberOfAttendees: 5,
          purpose: 'Meeting',
        })
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should reject update with invalid reservation id', async () => {
      const response = await request(app)
        .put('/api/reservations/invalid-id')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'confirmed' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject cancel with invalid reservation id', async () => {
      const response = await request(app)
        .delete('/api/reservations/invalid-id')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject reservation without authentication', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000);

      const response = await request(app)
        .post('/api/reservations')
        .send({
          room: roomId,
          startTime: tomorrow.toISOString(),
          endTime: dayAfter.toISOString(),
          numberOfAttendees: 5,
          purpose: 'Meeting',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject reservation with missing required fields', async () => {
      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          room: roomId,
        })
        .expect(422);

      expect(response.body.success).toBe(false);
    });
  });
});
