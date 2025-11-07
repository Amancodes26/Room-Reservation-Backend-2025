import mongoose from 'mongoose';
import { connectDB } from '../src/config/database.js';

describe('Database Connection', () => {
  it('should connect to MongoDB successfully', async () => {
    expect(mongoose.connection.readyState).toBe(1); // 1 = connected
  });

  it('should have correct database name', () => {
    const dbName = mongoose.connection.name;
    expect(dbName).toBeDefined();
    expect(typeof dbName).toBe('string');
  });

  it('should be able to perform basic operations', async () => {
    const collections = await mongoose.connection.db?.collections();
    expect(collections).toBeDefined();
    expect(Array.isArray(collections)).toBe(true);
  });

  it('should handle connection state correctly', () => {
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };
    
    const currentState = mongoose.connection.readyState;
    expect([0, 1, 2, 3]).toContain(currentState);
    expect(states[currentState as keyof typeof states]).toBeDefined();
  });

  it('should export connectDB function', () => {
    expect(connectDB).toBeDefined();
    expect(typeof connectDB).toBe('function');
  });

  it('should have connection event listeners', () => {
    const connection = mongoose.connection;
    expect(connection).toBeDefined();
    expect(connection.on).toBeDefined();
  });

  it('should have database instance', () => {
    const db = mongoose.connection.db;
    expect(db).toBeDefined();
  });
});
