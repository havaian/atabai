require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const cookieParser = require('cookie-parser');

// Import configurations
const { connect: connectDatabase } = require('./config/database');
const { connectRedis } = require('./config/redis');
require('./utils/logger');

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');

// Import routes
const authRoutes = require('./auth/routes');
const userRoutes = require('./user/routes');
const fileRoutes = require('./files/routes');
const templateRoutes = require('./templates/routes');
const adminRoutes = require('./admin/routes');
const publicLocaleRoutes = require('./admin/publicLocaleRoutes');

const app = express();

// Trust proxy (for deployment behind reverse proxy)
app.set('trust proxy', 1);

// Rate limiting
// Global limit — covers all requests. 600 / 15min = ~40 RPM per IP.
// This is high enough to accommodate users sharing a NAT (e.g. mobile hotspot
// with multiple devices) plus background polling (locale version poll every
// 30s, periodic profile fetches, etc.) without triggering 429 on normal use.
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 600,
    message: {
        error: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip the lightweight locale-version polling endpoint — it's hit every
    // 30s from each open tab and shouldn't eat the global quota. The full
    // bundle endpoint is NOT skipped (it transfers real data).
    skip: (req) => req.path === '/api/locales/version',
});

// Stricter limit for auth endpoints — guards against credential-stuffing and
// runaway OAuth callback retries. 30 / 15min is plenty for a legit user (even
// across multiple tabs and refreshes) but rejects brute-force attempts.
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: {
        error: 'Too many authentication attempts from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Don't count successful logins toward the limit — only failed/repeated ones
    skipSuccessfulRequests: true,
});

// Apply global rate limiting to all requests
app.use(limiter);

// Security middleware
app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));

// CORS configuration
app.use(cors({
    origin: function (origin, callback) {
        const allowedOrigins = [
            process.env.FRONTEND_URL || 'http://localhost:8080',
            'http://localhost:3000',
            'http://localhost:80',
            'http://localhost:7777'  // Added for development
        ];
        // const allowedOrigins = '*';

        // Allow requests with no origin (mobile apps, etc.)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
}));

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Data sanitization middleware
// app.use(mongoSanitize());
// app.use(xss());

// Compression middleware
app.use(compression());

// Logging middleware with enhanced Morgan integration
if (process.env.NODE_ENV === 'development') {
    app.use(morgan(logger.http.devFormat, {
        stream: global.logger.http.stream
    }));
} else {
    app.use(morgan(logger.http.prodFormat, {
        stream: global.logger.http.stream
    }));
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
        version: process.env.npm_package_version || '1.0.0'
    });
});

// API routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/locales', publicLocaleRoutes);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'ATABAI API Server',
        version: '1.0.0',
        docs: '/api/docs',
        health: '/health'
    });
});

// Error handling middleware (must be last)
app.use(notFound);
// app.use(errorHandler);

// Stuck jobs cleanup middleware
require('./middleware/jobCleanup');

// Initialize database connections
const initializeApp = async () => {    
    try {
        // Connect to MongoDB
        await connectDatabase(process.env.MONGO_URI);
        global.logger.logInfo('MongoDB connected', { category: 'startup' });

        // Best-effort idempotent mapping seed (doesn't block startup on failure)
        const { runSeedAtStartup } = require('./admin/mappingSeed');
        await runSeedAtStartup();

        // Best-effort idempotent locale seed — populates LocaleKey collection
        // from the bundled JSON files in src/admin/seedLocales/.
        const { runSeedAtStartup: runLocaleSeedAtStartup } = require('./admin/localeSeed');
        await runLocaleSeedAtStartup();

        // Email whitelist bootstrap — only when ENABLE_EMAIL_WHITELIST=true and
        // the collection is empty. Auto-seeds existing users so we don't lock
        // anyone out on first enable. Idempotent — safe to call every startup.
        const { runBootstrapAtStartup: runWhitelistBootstrap } = require('./admin/whitelist.service');
        await runWhitelistBootstrap();

        // await connectRedis();
        // global.logger.logInfo('Redis connected successfully', { category: 'startup' });

        const PORT = process.env.BACKEND_PORT || 3000;
        const server = app.listen(PORT, '0.0.0.0', () => {
            global.logger.logInfo(`Server listening on port ${PORT} (${process.env.NODE_ENV})`, {
                port: PORT,
                environment: process.env.NODE_ENV,
                category: 'startup'
            });
        });

        // Graceful shutdown
        const gracefulShutdown = (signal) => {
            global.logger.logInfo(`Received ${signal}. Graceful shutdown initiated`, {
                signal,
                category: 'shutdown'
            });
            server.close(() => {
                global.logger.logInfo('HTTP server closed', { category: 'shutdown' });
                process.exit(0);
            });
        };

        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    } catch (error) {
        global.logger.logError(error, { context: 'startup', category: 'startup' });
        process.exit(1);
    }
};

initializeApp();

module.exports = app;