require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

/**
 * Initialize backend service:
 * 1. Establish database connection to MongoDB Atlas first.
 * 2. Start Express HTTP server only if connection succeeds.
 * 3. Handle connection failures gracefully and exit with non-zero code.
 */
const startServer = async () => {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await connectDB();

    const server = app.listen(PORT, () => {
      console.log(`Express server running on port ${PORT}`);
    });

    return server;
  } catch (error) {
    console.error(`Server startup aborted due to database connection failure: ${error.message}`);
    process.exit(1);
  }
};

startServer();

module.exports = startServer;

