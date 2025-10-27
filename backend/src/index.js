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
const connectDB = require('./config/database');
const connectRedis = require('./config/redis');
const logger = require('./utils/logger');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const fileRoutes = require('./routes/files');
const templateRoutes = require('./routes/templates');

const app = express();

// Trust proxy (for deployment behind reverse proxy)
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply rate limiting to all requests
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
            'http://localhost:80'
        ];

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
app.use(mongoSanitize());
app.use(xss());

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined', {
        stream: {
            write: (message) => logger.info(message.trim())
        }
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
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/templates', templateRoutes);

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
app.use(errorHandler);

// Initialize database connections
const initializeApp = async () => {
    try {
        // Connect to MongoDB
        await connectDB();
        logger.info('MongoDB connected successfully');

        // Connect to Redis
        await connectRedis();
        logger.info('Redis connected successfully');

        // Start server
        const PORT = process.env.PORT || 3000;
        const server = app.listen(PORT, '0.0.0.0', () => {
            logger.info(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
        });

        // Graceful shutdown
        const gracefulShutdown = (signal) => {
            logger.info(`Received ${signal}. Graceful shutdown initiated...`);
            server.close(() => {
                logger.info('HTTP server closed');
                process.exit(0);
            });
        };

        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    } catch (error) {
        logger.error('Failed to initialize application:', error);
        process.exit(1);
    }
};

// Start the application
if (require.main === module) {
    initializeApp();
}

module.exports = app;