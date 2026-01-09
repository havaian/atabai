/**
 * Database Connection Module
 * MongoDB with Mongoose - Connection pooling, retry logic, health checks
 */

const mongoose = require('mongoose');

class DatabaseConnection {
    constructor() {
        this.isConnected = false;
        this.connectionAttempts = 0;
        this.maxRetries = 5;
        this.retryDelay = 5000; // 5 seconds
    }

    /**
     * Initialize database connection with retry logic
     */
    async connect(MONGO_URI = '') {
        const mongoUri = MONGO_URI || this.buildConnectionString();
        const options = this.getConnectionOptions();

        try {
            global.logger.logInfo('🔌 Attempting to connect to MongoDB...');

            await mongoose.connect(mongoUri, options);

            this.isConnected = true;
            this.connectionAttempts = 0;

            global.logger.logInfo('✅ MongoDB connected successfully');
            global.logger.logInfo(`📊 Database: ${mongoose.connection.name}`);
            global.logger.logInfo(`🌐 Host: ${mongoose.connection.host}:${mongoose.connection.port}`);

            // Set up connection event handlers
            this.setupEventHandlers();

            return true;
        } catch (error) {
            this.connectionAttempts++;
            global.logger.logError(`❌ MongoDB connection failed (attempt ${this.connectionAttempts}/${this.maxRetries}):`, error.message);

            if (this.connectionAttempts < this.maxRetries) {
                global.logger.logInfo(`🔄 Retrying in ${this.retryDelay / 1000} seconds...`);
                await this.delay(this.retryDelay);
                return this.connect();
            } else {
                global.logger.logError('💀 Maximum connection attempts reached. Exiting...');
                process.exit(1);
            }
        }
    }

    /**
     * Build MongoDB connection string from environment variables
     */
    buildConnectionString() {
        const {
            MONGO_HOST = 'localhost',
            MONGO_PORT = '27017',
            MONGO_DATABASE = 'project',
            MONGO_USERNAME,
            MONGO_PASSWORD,
            MONGO_AUTH_SOURCE = 'admin'
        } = process.env;

        let uri = 'mongodb://';

        // Add authentication if provided
        if (MONGO_USERNAME && MONGO_PASSWORD) {
            uri += `${encodeURIComponent(MONGO_USERNAME)}:${encodeURIComponent(MONGO_PASSWORD)}@`;
        }

        uri += `${MONGO_HOST}:${MONGO_PORT}/${MONGO_DATABASE}`;

        // Add auth source if authentication is used
        if (MONGO_USERNAME && MONGO_PASSWORD) {
            uri += `?authSource=${MONGO_AUTH_SOURCE}`;
        }

        return process.env.MONGO_URI || uri;
    }

    /**
     * Get optimized connection options for production
     */
    getConnectionOptions() {
        return {
            // Connection pool settings
            maxPoolSize: 10,          // Maximum number of connections
            minPoolSize: 2,           // Minimum number of connections
            maxIdleTimeMS: 30000,     // Close connections after 30 seconds of inactivity

            // Timeout settings
            serverSelectionTimeoutMS: 5000,  // How long to try selecting a server
            socketTimeoutMS: 45000,          // How long to wait for socket operations
            connectTimeoutMS: 10000,         // How long to wait for initial connection

            // Resilience settings
            heartbeatFrequencyMS: 10000,     // How often to check server availability
            retryWrites: true,               // Retry failed writes
            retryReads: true,                // Retry failed reads

            // // Buffer settings
            // bufferMaxEntries: 0,            // Disable mongoose buffering
            // bufferCommands: false,          // Disable mongoose buffering
        };
    }

    /**
     * Set up connection event handlers
     */
    setupEventHandlers() {
        // Connection events
        mongoose.connection.on('connected', () => {
            global.logger.logInfo('📡 Mongoose connected to MongoDB');
        });

        mongoose.connection.on('error', (error) => {
            global.logger.logError('❌ Mongoose connection error:', error.message);
        });

        mongoose.connection.on('disconnected', () => {
            global.logger.logWarn('⚠️ Mongoose disconnected from MongoDB');
            this.isConnected = false;
        });

        mongoose.connection.on('reconnected', () => {
            global.logger.logInfo('🔄 Mongoose reconnected to MongoDB');
            this.isConnected = true;
        });

        // Graceful shutdown handlers
        process.on('SIGINT', this.gracefulShutdown.bind(this));
        process.on('SIGTERM', this.gracefulShutdown.bind(this));
        process.on('SIGUSR2', this.gracefulShutdown.bind(this)); // For nodemon
    }

    /**
     * Health check for the database connection
     */
    async healthCheck() {
        try {
            if (!this.isConnected) {
                return { status: 'disconnected', message: 'Database not connected' };
            }

            // Ping the database
            const adminDb = mongoose.connection.db.admin();
            const result = await adminDb.ping();

            if (result.ok === 1) {
                return {
                    status: 'healthy',
                    message: 'Database connection is healthy',
                    database: mongoose.connection.name,
                    host: `${mongoose.connection.host}:${mongoose.connection.port}`,
                    readyState: mongoose.connection.readyState,
                    collections: await this.getCollectionCount()
                };
            } else {
                return { status: 'unhealthy', message: 'Database ping failed' };
            }
        } catch (error) {
            return {
                status: 'error',
                message: `Health check failed: ${error.message}`
            };
        }
    }

    /**
     * Get collection count for health check info
     */
    async getCollectionCount() {
        try {
            const collections = await mongoose.connection.db.listCollections().toArray();
            return collections.length;
        } catch (error) {
            return 'unknown';
        }
    }

    /**
     * Get connection status for monitoring
     */
    getStatus() {
        const states = {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting'
        };

        return {
            isConnected: this.isConnected,
            readyState: states[mongoose.connection.readyState] || 'unknown',
            host: mongoose.connection.host,
            port: mongoose.connection.port,
            database: mongoose.connection.name
        };
    }

    /**
     * Graceful shutdown
     */
    async gracefulShutdown(signal) {
        global.logger.logInfo(`\n🔄 Received ${signal}. Closing MongoDB connection...`);

        try {
            await mongoose.connection.close();
            global.logger.logInfo('✅ MongoDB connection closed successfully');
            process.exit(0);
        } catch (error) {
            global.logger.logError('❌ Error during MongoDB shutdown:', error.message);
            process.exit(1);
        }
    }

    /**
     * Utility function to create delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Create singleton instance
const dbConnection = new DatabaseConnection();

// Export connection methods
module.exports = {
    connect: (MONGO_URI) => dbConnection.connect(MONGO_URI),
    healthCheck: () => dbConnection.healthCheck(),
    getStatus: () => dbConnection.getStatus(),
    mongoose: mongoose // Export mongoose for model creation
};