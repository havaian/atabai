/**
 * 404 Not Found middleware
 * Handles requests to undefined routes
 */
const notFound = (req, res, next) => {
    global.logger.logWarn(`404 - Route not found: ${req.method} ${req.originalUrl}`, {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });

    res.status(404).json({
        success: false,
        error: 'ROUTE_NOT_FOUND',
        message: `Route ${req.method} ${req.originalUrl} not found`,
        timestamp: new Date().toISOString()
    });
};

module.exports = notFound;