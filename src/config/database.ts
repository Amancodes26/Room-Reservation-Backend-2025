import mongoose from 'mongoose';
import { env } from './env';

export const connectDB = async (): Promise<void> => {
  try {
    const MONGODB_URI = env.mongodbUri;

    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not defined');
    }

    // Set connection timeout
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
    });

    console.log('✅ MongoDB Connected Successfully');
    console.log(`📊 Database: ${mongoose.connection.name}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed through app termination');
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    console.error('\n💡 Quick Solutions:');
    console.error('   1. Install MongoDB locally: https://www.mongodb.com/try/download/community');
    console.error('   2. Use MongoDB Atlas (Free Cloud): https://www.mongodb.com/cloud/atlas');
    console.error('   3. Run tests instead (uses in-memory DB): npm test\n');
    throw error;
  }
};
