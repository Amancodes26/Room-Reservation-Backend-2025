import app from './app';
import { connectDB } from './config/database';
import { env } from './config/env';

/**
 * Start the server
 */
const startServer = async (): Promise<void> => {
  try {
    // Connect to database
    await connectDB();

    // Start server
    const server = app.listen(env.port, () => {
      console.log('🚀 Server started successfully');
      console.log(`📡 Environment: ${env.nodeEnv}`);
      console.log(`🌐 Server running on port: ${env.port}`);
      console.log(`🔗 Base URL: http://localhost:${env.port}`);
      console.log(`📋 Health check: http://localhost:${env.port}/health`);
      console.log('\n✨ Ready to accept requests!\n');
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n${signal} received. Starting graceful shutdown...`);
      
      server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the application
startServer();
