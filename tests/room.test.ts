import request from 'supertest';
import app from '../src/app.js';
import { User, UserRole } from '../src/models/User.js';
import { Room } from '../src/models/Room.js';
import { generateTokens } from '../src/utils/jwt.js';

describe('Room Controller', () => {
  let adminToken: string;
  let userToken: string;
  let testRoom: any; // Room for testing availability endpoints

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

    // Create a test room for availability endpoints
    testRoom = await Room.create({
      name: 'Test Availability Room',
      description: 'Room for testing availability',
      capacity: 10,
      pricePerHour: 30,
    });
  });

  describe('GET /api/rooms', () => {
    beforeEach(async () => {
      await Room.create([
        {
          name: 'Conference Room A',
          description: 'Large conference room',
          capacity: 20,
          pricePerHour: 50,
          isActive: true,
        },
        {
          name: 'Meeting Room B',
          description: 'Small meeting room',
          capacity: 5,
          pricePerHour: 20,
          isActive: true,
        },
      ]);
    });

    it('should get all rooms without authentication', async () => {
      const response = await request(app).get('/api/rooms').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
      expect(response.body.meta).toBeDefined();
    });

    it('should filter rooms by capacity', async () => {
      const response = await request(app)
        .get('/api/rooms')
        .query({ minCapacity: 15 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data.every((room: any) => room.capacity >= 15)).toBe(true);
    });

    it('should filter rooms by price range', async () => {
      const response = await request(app)
        .get('/api/rooms')
        .query({ minPrice: 40, maxPrice: 60 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data.every((room: any) => 
        room.pricePerHour >= 40 && room.pricePerHour <= 60
      )).toBe(true);
    });

    it('should search rooms by name', async () => {
      const response = await request(app)
        .get('/api/rooms')
        .query({ search: 'Conference' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/rooms')
        .query({ page: 1, limit: 1 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.limit).toBe(1);
    });
  });

  describe('POST /api/rooms', () => {
    it('should create room as admin', async () => {
      const roomData = {
        name: 'New Conference Room',
        description: 'Brand new room',
        capacity: 15,
        pricePerHour: 40,
        amenities: [{ name: 'Projector' }, { name: 'Whiteboard' }],
      };

      const response = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(roomData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(roomData.name);
    });

    it('should not create room as regular user', async () => {
      const roomData = {
        name: 'New Conference Room',
        description: 'Brand new room',
        capacity: 15,
        pricePerHour: 40,
      };

      const response = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${userToken}`)
        .send(roomData)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should not create room without authentication', async () => {
      const roomData = {
        name: 'New Conference Room',
        description: 'Brand new room',
        capacity: 15,
        pricePerHour: 40,
      };

      await request(app).post('/api/rooms').send(roomData).expect(401);
    });

    it('should validate room data', async () => {
      const invalidRoomData = {
        name: 'R', // Too short
        description: 'Test',
        capacity: 0, // Too small
        pricePerHour: -10, // Negative
      };

      const response = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidRoomData)
        .expect(422);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/rooms/:id', () => {
    it('should get room by id', async () => {
      const response = await request(app)
        .get(`/api/rooms/${testRoom._id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(testRoom.name);
    });

    it('should return 404 for non-existent room', async () => {
      const response = await request(app)
        .get('/api/rooms/507f1f77bcf86cd799439011')
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid room id', async () => {
      const response = await request(app)
        .get('/api/rooms/invalid-id')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/rooms/:id/availability', () => {
    it('should check room availability', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date();
      dayAfter.setDate(dayAfter.getDate() + 2);

      const response = await request(app)
        .get(`/api/rooms/${testRoom._id}/availability?startDate=${tomorrow.toISOString()}&endDate=${dayAfter.toISOString()}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should return false if room has reservation', async () => {
      // Create a reservation first
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date();
      dayAfter.setDate(dayAfter.getDate() + 2);

      await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          room: testRoom._id,
          startTime: tomorrow.toISOString(),
          endTime: dayAfter.toISOString(),
          numberOfAttendees: 5,
          purpose: 'Meeting',
        });

      const response = await request(app)
        .get(`/api/rooms/${testRoom._id}/availability?startDate=${tomorrow.toISOString()}&endDate=${dayAfter.toISOString()}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.bookedSlots.length).toBeGreaterThan(0);
    });

    it('should require startDate and endDate', async () => {
      const response = await request(app)
        .get(`/api/rooms/${testRoom._id}/availability`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/rooms/:id', () => {
    let roomId: string;

    beforeEach(async () => {
      const room = await Room.create({
        name: 'Test Room',
        description: 'Test description',
        capacity: 10,
        pricePerHour: 30,
      });
      roomId = room._id.toString();
    });

    it('should update room as admin', async () => {
      const updates = {
        name: 'Updated Room Name',
        capacity: 15,
      };

      const response = await request(app)
        .put(`/api/rooms/${roomId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updates.name);
      expect(response.body.data.capacity).toBe(updates.capacity);
    });

    it('should not update room as regular user', async () => {
      const updates = { name: 'Updated Room Name' };

      const response = await request(app)
        .put(`/api/rooms/${roomId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updates)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/rooms/:id', () => {
    let roomId: string;

    beforeEach(async () => {
      const room = await Room.create({
        name: 'Test Room',
        description: 'Test description',
        capacity: 10,
        pricePerHour: 30,
      });
      roomId = room._id.toString();
    });

    it('should delete room as admin', async () => {
      const response = await request(app)
        .delete(`/api/rooms/${roomId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify room is deleted
      const deletedRoom = await Room.findById(roomId);
      expect(deletedRoom).toBeNull();
    });

    it('should not delete room as regular user', async () => {
      await request(app)
        .delete(`/api/rooms/${roomId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent room', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      await request(app)
        .delete(`/api/rooms/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });
});
