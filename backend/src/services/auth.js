const jwt = require('jsonwebtoken');
const { promisify } = require('util');

class AuthService {
    constructor() {
        this.jwtSecret = process.env.JWT_SECRET;
        this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
        this.refreshSecret = process.env.JWT_REFRESH_SECRET;
        this.refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

        if (!this.jwtSecret || !this.refreshSecret) {
            throw new Error('JWT secrets are not configured');
        }

        // Promisify JWT methods
        this.signAsync = promisify(jwt.sign);
        this.verifyAsync = promisify(jwt.verify);
    }

    /**
     * Generate access token for user
     * @param {Object} user - User object
     * @returns {Promise<string>} Access token
     */
    async generateAccessToken(user) {
        try {
            const payload = {
                userId: user._id.toString(),
                email: user.email,
                subscriptionType: user.subscriptionType,
                iat: Math.floor(Date.now() / 1000)
            };

            const token = await this.signAsync(payload, this.jwtSecret, {
                expiresIn: this.jwtExpiresIn,
                issuer: 'atabai-api',
                audience: 'atabai-client'
            });

            global.logger.logDebug(`Generated access token for user: ${user.email}`);
            return token;
        } catch (error) {
            global.logger.logError('Error generating access token:', error);
            throw new Error('Failed to generate access token');
        }
    }

    /**
     * Generate refresh token for user
     * @param {Object} user - User object
     * @returns {Promise<string>} Refresh token
     */
    async generateRefreshToken(user) {
        try {
            const payload = {
                userId: user._id.toString(),
                type: 'refresh',
                iat: Math.floor(Date.now() / 1000)
            };

            const token = await this.signAsync(payload, this.refreshSecret, {
                expiresIn: this.refreshExpiresIn,
                issuer: 'atabai-api',
                audience: 'atabai-client'
            });

            global.logger.logDebug(`Generated refresh token for user: ${user.email}`);
            return token;
        } catch (error) {
            global.logger.logError('Error generating refresh token:', error);
            throw new Error('Failed to generate refresh token');
        }
    }

    /**
     * Generate both access and refresh tokens
     * @param {Object} user - User object
     * @returns {Promise<Object>} Object with accessToken and refreshToken
     */
    async generateTokenPair(user) {
        try {
            const [accessToken, refreshToken] = await Promise.all([
                this.generateAccessToken(user),
                this.generateRefreshToken(user)
            ]);

            return { accessToken, refreshToken };
        } catch (error) {
            global.logger.logError('Error generating token pair:', error);
            throw new Error('Failed to generate authentication tokens');
        }
    }

    /**
     * Verify access token
     * @param {string} token - Access token to verify
     * @returns {Promise<Object>} Decoded token payload
     */
    async verifyAccessToken(token) {
        try {
            const decoded = await this.verifyAsync(token, this.jwtSecret, {
                issuer: 'atabai-api',
                audience: 'atabai-client'
            });

            return decoded;
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                global.logger.logDebug('Access token expired');
                throw new Error('ACCESS_TOKEN_EXPIRED');
            }
            if (error.name === 'JsonWebTokenError') {
                global.logger.logWarn('Invalid access token');
                throw new Error('INVALID_ACCESS_TOKEN');
            }

            global.logger.logError('Error verifying access token:', error);
            throw new Error('TOKEN_VERIFICATION_FAILED');
        }
    }

    /**
     * Verify refresh token
     * @param {string} token - Refresh token to verify
     * @returns {Promise<Object>} Decoded token payload
     */
    async verifyRefreshToken(token) {
        try {
            const decoded = await this.verifyAsync(token, this.refreshSecret, {
                issuer: 'atabai-api',
                audience: 'atabai-client'
            });

            if (decoded.type !== 'refresh') {
                throw new Error('Invalid token type');
            }

            return decoded;
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                global.logger.logDebug('Refresh token expired');
                throw new Error('REFRESH_TOKEN_EXPIRED');
            }
            if (error.name === 'JsonWebTokenError') {
                global.logger.logWarn('Invalid refresh token');
                throw new Error('INVALID_REFRESH_TOKEN');
            }

            global.logger.logError('Error verifying refresh token:', error);
            throw new Error('TOKEN_VERIFICATION_FAILED');
        }
    }

    /**
     * Extract token from Authorization header
     * @param {string} authHeader - Authorization header value
     * @returns {string|null} Extracted token or null
     */
    extractTokenFromHeader(authHeader) {
        if (!authHeader) return null;

        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            return null;
        }

        return parts[1];
    }

    /**
     * Create user session data for frontend
     * @param {Object} user - User object
     * @param {string} accessToken - Access token
     * @param {string} refreshToken - Refresh token
     * @returns {Object} Session data
     */
    createUserSession(user, accessToken, refreshToken) {
        return {
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                picture: user.picture,
                subscriptionType: user.subscriptionType,
                filesProcessedThisMonth: user.filesProcessedThisMonth,
                preferences: user.preferences,
                canProcessFiles: user.canProcessFiles()
            },
            accessToken,
            refreshToken,
            expiresIn: this.jwtExpiresIn
        };
    }

    /**
     * Revoke token by adding to blacklist (Redis implementation)
     * @param {string} token - Token to revoke
     * @param {number} expiresIn - Token expiration time in seconds
     * @returns {Promise<void>}
     */
    async revokeToken(token, expiresIn = 3600) {
        try {
            // TODO: Implement Redis blacklist
            // For now, just log the revocation
            global.logger.logInfo(`Token revoked (would be added to blacklist): ${token.substring(0, 20)}...`);

            // In production, add to Redis:
            // await redisClient.setex(`blacklist:${token}`, expiresIn, 'revoked');
        } catch (error) {
            global.logger.logError('Error revoking token:', error);
            // Don't throw - token revocation failure shouldn't break logout
        }
    }

    /**
     * Check if token is blacklisted
     * @param {string} token - Token to check
     * @returns {Promise<boolean>} True if blacklisted
     */
    async isTokenBlacklisted(token) {
        try {
            // TODO: Implement Redis blacklist check
            // For now, always return false
            return false;

            // In production, check Redis:
            // const result = await redisClient.get(`blacklist:${token}`);
            // return result === 'revoked';
        } catch (error) {
            global.logger.logError('Error checking token blacklist:', error);
            return false; // Fail open for availability
        }
    }
}

module.exports = new AuthService();