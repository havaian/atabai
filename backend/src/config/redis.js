const redis = require('redis');

let redisClient = null;

// Redis connection options
const redisOptions = {
    socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        connectTimeout: 10000,
        lazyConnect: true,
        keepAlive: true
    },
    password: process.env.REDIS_PASSWORD || undefined,
    database: process.env.REDIS_DATABASE || 0,
    retryDelayOnFailover: 100,
    enableReadyCheck: true,
    maxRetriesPerRequest: 3
};

/**
 * Connect to Redis
 */
const connectRedis = async () => {
    try {
        // Create Redis client
        redisClient = redis.createClient(redisOptions);

        // Setup event handlers
        setupEventHandlers();

        // Connect to Redis
        await redisClient.connect();

        global.logger.logInfo(`Redis connected: ${redisOptions.socket.host}:${redisOptions.socket.port}`);

        return redisClient;
    } catch (error) {
        global.logger.logError('Redis connection failed:', error);
        throw new Error(`Redis connection failed: ${error.message}`);
    }
};

/**
 * Setup Redis event handlers
 */
const setupEventHandlers = () => {
    redisClient.on('connect', () => {
        global.logger.logDebug('Redis connecting...');
    });

    redisClient.on('ready', () => {
        global.logger.logInfo('Redis ready for operations');
    });

    redisClient.on('error', (error) => {
        global.logger.logError('Redis error:', error);
    });

    redisClient.on('end', () => {
        global.logger.logWarn('Redis connection ended');
    });

    redisClient.on('reconnecting', () => {
        global.logger.logInfo('Redis reconnecting...');
    });

    // Handle application termination
    process.on('SIGINT', async () => {
        try {
            if (redisClient && redisClient.isOpen) {
                await redisClient.quit();
                global.logger.logInfo('Redis connection closed through app termination');
            }
        } catch (error) {
            global.logger.logError('Error closing Redis connection:', error);
        }
    });
};

/**
 * Get Redis client instance
 */
const getRedisClient = () => {
    if (!redisClient) {
        throw new Error('Redis client not initialized. Call connectRedis() first.');
    }
    return redisClient;
};

/**
 * Disconnect from Redis
 */
const disconnectRedis = async () => {
    try {
        if (redisClient && redisClient.isOpen) {
            await redisClient.quit();
            global.logger.logInfo('Redis disconnected successfully');
        }
    } catch (error) {
        global.logger.logError('Error disconnecting from Redis:', error);
        throw error;
    }
};

/**
 * Redis health check
 */
const healthCheck = async () => {
    try {
        if (!redisClient) {
            throw new Error('Redis client not initialized');
        }

        if (!redisClient.isOpen) {
            throw new Error('Redis connection not open');
        }

        // Test Redis with a simple ping
        const result = await redisClient.ping();

        if (result !== 'PONG') {
            throw new Error('Redis ping failed');
        }

        return {
            status: 'healthy',
            host: redisOptions.socket.host,
            port: redisOptions.socket.port,
            database: redisOptions.database,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
};

/**
 * Cache helper functions
 */
const cache = {
    /**
     * Set a value in cache
     */
    async set(key, value, ttl = 3600) {
        try {
            const client = getRedisClient();
            const serializedValue = JSON.stringify(value);

            if (ttl > 0) {
                await client.setEx(key, ttl, serializedValue);
            } else {
                await client.set(key, serializedValue);
            }

            global.logger.logDebug(`Cache SET: ${key} (TTL: ${ttl}s)`);
        } catch (error) {
            global.logger.logError('Cache SET error:', error);
            throw error;
        }
    },

    /**
     * Get a value from cache
     */
    async get(key) {
        try {
            const client = getRedisClient();
            const value = await client.get(key);

            if (value === null) {
                global.logger.logDebug(`Cache MISS: ${key}`);
                return null;
            }

            global.logger.logDebug(`Cache HIT: ${key}`);
            return JSON.parse(value);
        } catch (error) {
            global.logger.logError('Cache GET error:', error);
            return null; // Fail gracefully for cache misses
        }
    },

    /**
     * Delete a value from cache
     */
    async del(key) {
        try {
            const client = getRedisClient();
            const result = await client.del(key);
            global.logger.logDebug(`Cache DEL: ${key} (deleted: ${result})`);
            return result;
        } catch (error) {
            global.logger.logError('Cache DEL error:', error);
            return 0;
        }
    },

    /**
     * Check if key exists in cache
     */
    async exists(key) {
        try {
            const client = getRedisClient();
            const result = await client.exists(key);
            return result === 1;
        } catch (error) {
            global.logger.logError('Cache EXISTS error:', error);
            return false;
        }
    },

    /**
     * Set expiration for a key
     */
    async expire(key, ttl) {
        try {
            const client = getRedisClient();
            await client.expire(key, ttl);
            global.logger.logDebug(`Cache EXPIRE: ${key} (TTL: ${ttl}s)`);
        } catch (error) {
            global.logger.logError('Cache EXPIRE error:', error);
        }
    },

    /**
     * Increment a value
     */
    async incr(key) {
        try {
            const client = getRedisClient();
            const result = await client.incr(key);
            global.logger.logDebug(`Cache INCR: ${key} (value: ${result})`);
            return result;
        } catch (error) {
            global.logger.logError('Cache INCR error:', error);
            return 0;
        }
    }
};

module.exports = {
    connectRedis,
    disconnectRedis,
    getRedisClient,
    healthCheck,
    cache
};