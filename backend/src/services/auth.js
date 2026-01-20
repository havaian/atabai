const jwt = require('jsonwebtoken');
const { promisify } = require('util');

class AuthService {
    constructor() {
        // Keep global secrets as fallback for system operations
        this.jwtSecret = process.env.JWT_SECRET || 'fallback-secret-change-me';
        this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
        this.refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

        // Promisify JWT methods
        this.signAsync = promisify(jwt.sign);
        this.verifyAsync = promisify(jwt.verify);
    }

    /**
     * Generate access token for user using their personal secret
     * @param {Object} user - User object (must have refreshTokenSecret loaded)
     * @returns {Promise<string>} Access token
     */
    async generateAccessToken(user) {
        try {
            // Ensure user has a secret
            const secret = await user.getRefreshTokenSecret();

            const payload = {
                userId: user._id.toString(),
                email: user.email,
                subscriptionType: user.subscriptionType,
                iat: Math.floor(Date.now() / 1000)
            };

            const token = await this.signAsync(payload, secret, {
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
     * Generate refresh token for user using their personal secret
     * @param {Object} user - User object (must have refreshTokenSecret loaded)
     * @returns {Promise<string>} Refresh token
     */
    async generateRefreshToken(user) {
        try {
            // Ensure user has a secret
            const secret = await user.getRefreshTokenSecret();

            const payload = {
                userId: user._id.toString(),
                type: 'refresh',
                iat: Math.floor(Date.now() / 1000)
            };

            const token = await this.signAsync(payload, secret, {
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
     * @param {Object} user - User object (must have refreshTokenSecret loaded)
     * @returns {Promise<Object>} Object with accessToken and refreshToken
     */
    async generateTokenPair(user) {
        try {
            // Ensure user has their secret loaded
            await user.getRefreshTokenSecret();

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
     * Verify access token using user's personal secret
     * @param {string} token - Access token to verify
     * @param {Object} user - User object (must have refreshTokenSecret loaded)
     * @returns {Promise<Object>} Decoded token payload
     */
    async verifyAccessToken(token, user = null) {
        try {
            // If user is provided, verify with their secret
            let secret = this.jwtSecret; // Fallback to global secret

            if (user) {
                secret = await user.getRefreshTokenSecret();
            }

            const decoded = await this.verifyAsync(token, secret, {
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
     * Verify refresh token using user's personal secret
     * @param {string} token - Refresh token to verify
     * @param {Object} user - User object (must have refreshTokenSecret loaded)
     * @returns {Promise<Object>} Decoded token payload
     */
    async verifyRefreshToken(token, user = null) {
        try {
            // If user is provided, verify with their secret
            let secret = this.jwtSecret; // Fallback to global secret

            if (user) {
                secret = await user.getRefreshTokenSecret();
            }

            const decoded = await this.verifyAsync(token, secret, {
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
     * Decode token without verification (to get userId)
     * @param {string} token - JWT token
     * @returns {Object|null} Decoded payload or null
     */
    decodeToken(token) {
        try {
            return jwt.decode(token);
        } catch (error) {
            global.logger.logWarn('Failed to decode token:', error);
            return null;
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
                id: user._id.toString(),
                email: user.email,
                name: user.name,
                picture: user.picture,
                subscriptionType: user.subscriptionType,
                filesProcessedThisMonth: user.filesProcessedThisMonth
            },
            accessToken,
            refreshToken
        };
    }

    /**
     * Check if token is blacklisted (placeholder for future Redis implementation)
     * @param {string} token - Token to check
     * @returns {Promise<boolean>}
     */
    async isTokenBlacklisted(token) {
        // TODO: Implement Redis-based token blacklist
        // For now, return false
        return false;
    }

    /**
     * Revoke token by adding to blacklist (placeholder for future Redis implementation)
     * @param {string} token - Token to revoke
     * @param {number} expiresIn - TTL in seconds
     * @returns {Promise<void>}
     */
    async revokeToken(token, expiresIn) {
        try {
            // TODO: Implement Redis-based token blacklist
            // await redis.setex(`blacklist:${token}`, expiresIn, '1');

            global.logger.logInfo(`Token revoked (would be added to blacklist): ${token.substring(0, 20)}...`);
        } catch (error) {
            global.logger.logError('Error revoking token:', error);
            // Don't throw error, token revocation failure shouldn't break logout
        }
    }
}

module.exports = new AuthService();