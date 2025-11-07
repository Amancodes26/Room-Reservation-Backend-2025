import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer: MongoMemoryServer;

// Setup before all tests
beforeAll(async () => {
  // Create in-memory MongoDB instance
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  // Connect to the in-memory database
  await mongoose.connect(mongoUri);
}, 30000); // 30 second timeout for MongoDB setup

// Cleanup after each test
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key]?.deleteMany({});
  }
});

// Cleanup after all tests
afterAll(async () => {
  // Close all connections gracefully
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  
  // Stop MongoDB memory server
  if (mongoServer) {
    await mongoServer.stop();
  }
  
  // Clear any timers or pending promises
  await new Promise(resolve => setTimeout(resolve, 100));
}, 30000); // 30 second timeout for cleanup

