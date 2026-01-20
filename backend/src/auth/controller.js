const User = require('../user/model');
const authService = require('../services/auth');
const { getFileLimit } = require('../config/subscription');
const axios = require('axios');

class AuthController {
    /**
     * Initiate Google OAuth login
     * GET /api/auth/google
     */
    async initiateGoogleLogin(req, res) {
        try {
            // Generate auth URL for Google OAuth
            const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
                `client_id=${process.env.GOOGLE_CLIENT_ID}&` +
                `redirect_uri=${encodeURIComponent(process.env.FRONTEND_URL || 'http://localhost:8080')}/api/auth/google/callback&` +
                `response_type=code&` +
                `scope=profile email&` +
                `access_type=offline&` +
                `prompt=consent`;

            res.json({
                success: true,
                authUrl,
                message: 'Redirect to Google OAuth'
            });
        } catch (error) {
            global.logger.logError('Error initiating Google login:', error);
            res.status(500).json({
                error: 'OAUTH_INITIATION_FAILED',
                message: 'Failed to initiate Google login'
            });
        }
    }

    async createUserSession(user, accessToken, refreshToken) {
        try {
            global.logger.logInfo(`User logged in successfully: ${user.email}`);

            res.json({
                success: true,
                message: 'Login successful',
                ...sessionData
            });

        } catch (error) {
            global.logger.logError('Google OAuth callback error:', error);
            res.status(500).json({
                error: 'OAUTH_CALLBACK_FAILED',
                message: 'OAuth callback failed'
            });
        }
    }

    /**
     * Handle Google OAuth callback
     * POST /api/auth/google/callback
     */
    async handleGoogleCallback(req, res) {
        global.logger.logInfo('🔧 OAuth callback received');
        global.logger.logInfo('🔧 Request body:', req.body);

        try {
            const { code } = req.body;

            if (!code) {
                global.logger.logInfo('❌ No OAuth code provided');
                return res.status(400).json({
                    error: 'OAUTH_CODE_MISSING',
                    message: 'OAuth authorization code is required'
                });
            }

            global.logger.logInfo('🔧 OAuth code received:', code.substring(0, 10) + '...');

            // Exchange authorization code for access token
            global.logger.logInfo('🔧 Exchanging code for tokens...');
            const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: `${process.env.FRONTEND_URL}/auth/callback`
            });

            const { access_token } = tokenResponse.data;
            global.logger.logInfo('🔧 Access token received');

            // Get user profile from Google
            global.logger.logInfo('🔧 Fetching user profile from Google...');
            const profileResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: {
                    Authorization: `Bearer ${access_token}`
                }
            });

            const googleProfile = profileResponse.data;
            global.logger.logInfo('🔧 Google profile received:', {
                id: googleProfile.id,
                email: googleProfile.email,
                name: googleProfile.name
            });

            // Find or create user
            const user = await User.findOrCreateFromGoogle({
                id: googleProfile.id,
                emails: [{ value: googleProfile.email }],
                displayName: googleProfile.name,
                photos: [{ value: googleProfile.picture }]
            });

            global.logger.logInfo(`🔧 User found/created: ${user.email}`);
            await user.updateLastLogin();

            // Generate tokens
            global.logger.logInfo('🔧 Generating JWT tokens...');
            const { accessToken: jwtToken, refreshToken } = await authService.generateTokenPair(user);

            // Create session data
            const sessionData = authService.createUserSession(user, jwtToken, refreshToken);

            global.logger.logInfo(`User logged in successfully: ${user.email}`, { category: 'auth' });

            res.json({
                success: true,
                message: 'Login successful',
                ...sessionData
            });

        } catch (error) {
            global.logger.logError('❌ DETAILED OAuth callback error:', error);
            global.logger.logError('❌ Error name:', error.name);
            global.logger.logError('❌ Error message:', error.message);

            if (error.response) {
                global.logger.logError('❌ API Error response:', {
                    status: error.response.status,
                    data: error.response.data
                });
            }

            global.logger.logError('Google OAuth callback error', {
                error: error.message,
                stack: error.stack,
                apiError: error.response?.data,
                category: 'auth-error'
            });

            res.status(500).json({
                error: 'OAUTH_CALLBACK_FAILED',
                message: 'OAuth callback failed: ' + error.message
            });
        }
    }

    /**
 * Handle Passport Google OAuth callback
 * This method is called after passport.authenticate('google') succeeds
 */
    async handlePassportCallback(req, res) {
        try {
            global.logger.logInfo('🔧 Passport OAuth callback received');

            if (!req.user) {
                global.logger.logInfo('❌ No user from Passport authentication');
                return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
            }

            global.logger.logInfo('🔧 User authenticated via Passport:', req.user.email);

            // Update last login
            await req.user.updateLastLogin();

            // Generate JWT tokens
            global.logger.logInfo('🔧 Generating JWT tokens...');
            const { accessToken, refreshToken } = await authService.generateTokenPair(req.user);

            // Create session data
            const sessionData = authService.createUserSession(req.user, accessToken, refreshToken);

            // Redirect to frontend with tokens as URL parameters (for SPA)
            const redirectUrl = `${process.env.FRONTEND_URL}/auth/success?` +
                `access_token=${encodeURIComponent(accessToken)}&` +
                `refresh_token=${encodeURIComponent(refreshToken)}&` +
                `user=${encodeURIComponent(JSON.stringify({
                    id: req.user._id,
                    email: req.user.email,
                    name: req.user.name,
                    subscriptionType: req.user.subscriptionType
                }))}`;

            global.logger.logInfo('🔧 Redirecting to:', `${process.env.FRONTEND_URL}/auth/success`);

            global.logger.logInfo(`User logged in successfully via Passport: ${req.user.email}`, { category: 'auth' });

            res.redirect(redirectUrl);

        } catch (error) {
            global.logger.logError('❌ Passport OAuth callback error:', error);

            global.logger.logError('Passport OAuth callback error', {
                error: error.message,
                stack: error.stack,
                category: 'auth-error'
            });

            res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
        }
    }

    /**
     * Handle manual Google OAuth callback (rename existing method)
     * POST /api/auth/google/callback
     */
    async handleManualCallback(req, res) {
        // This is your existing handleGoogleCallback method
        // Just rename it to handleManualCallback
        global.logger.logInfo('🔧 Manual OAuth callback received');
        global.logger.logInfo('🔧 Request body:', req.body);

        try {
            const { code } = req.body;

            if (!code) {
                global.logger.logInfo('❌ No OAuth code provided');
                return res.status(400).json({
                    error: 'OAUTH_CODE_MISSING',
                    message: 'OAuth authorization code is required'
                });
            }

            // ... rest of your existing handleGoogleCallback logic
        } catch (error) {
            // ... existing error handling
        }
    }

    // Updated refreshToken method for auth controller
    // Replace your existing refreshToken method with this

    /**
     * Refresh access token
     * POST /api/auth/refresh
     */
    async refreshToken(req, res) {
        try {
            const { refreshToken } = req.body;

            if (!refreshToken) {
                return res.status(400).json({
                    error: 'REFRESH_TOKEN_REQUIRED',
                    message: 'Refresh token is required'
                });
            }

            // STEP 1: Decode refresh token to get userId (without verification)
            const decoded = authService.decodeToken(refreshToken);
            if (!decoded || !decoded.userId) {
                return res.status(401).json({
                    error: 'INVALID_REFRESH_TOKEN',
                    message: 'Invalid refresh token format'
                });
            }

            // STEP 2: Find user with their secret
            const user = await User.findById(decoded.userId)
                .select('+refreshTokenSecret +refreshTokenSecretCreatedAt');

            if (!user || !user.isActive) {
                return res.status(401).json({
                    error: 'USER_NOT_FOUND',
                    message: 'User not found or inactive'
                });
            }

            // STEP 3: Verify refresh token with user's personal secret
            try {
                await authService.verifyRefreshToken(refreshToken, user);
            } catch (verifyError) {
                if (verifyError.message === 'REFRESH_TOKEN_EXPIRED') {
                    return res.status(401).json({
                        error: 'REFRESH_TOKEN_EXPIRED',
                        message: 'Refresh token has expired. Please login again.'
                    });
                }

                if (verifyError.message === 'INVALID_REFRESH_TOKEN') {
                    return res.status(401).json({
                        error: 'INVALID_REFRESH_TOKEN',
                        message: 'Invalid refresh token'
                    });
                }

                throw verifyError;
            }

            // Reset monthly counter if needed
            await user.resetMonthlyCounterIfNeeded();

            // Generate new access token (user already has secret loaded)
            const newAccessToken = await authService.generateAccessToken(user);

            global.logger.logInfo(`Access token refreshed for user: ${user.email}`);

            res.json({
                success: true,
                accessToken: newAccessToken,
                message: 'Token refreshed successfully'
            });

        } catch (error) {
            global.logger.logWarn(`Token refresh failed: ${error.message}`);

            res.status(500).json({
                error: 'TOKEN_REFRESH_FAILED',
                message: 'Failed to refresh token'
            });
        }
    }

    /**
     * Get current user profile
     * GET /api/auth/profile
     */
    async getProfile(req, res) {
        try {
            // User is already attached to request by auth middleware
            const user = req.user;

            res.json({
                success: true,
                user: {
                    id: user._id,
                    email: user.email,
                    name: user.name,
                    picture: user.picture,
                    subscriptionType: user.subscriptionType,
                    filesProcessedThisMonth: user.filesProcessedThisMonth,
                    monthlyLimit: await getFileLimit(user.subscriptionType),
                    canProcessFiles: user.canProcessFiles(),
                    preferences: user.preferences,
                    lastLoginAt: user.lastLoginAt,
                    createdAt: user.createdAt
                }
            });

        } catch (error) {
            global.logger.logError('Error fetching user profile:', error);
            res.status(500).json({
                error: 'PROFILE_FETCH_FAILED',
                message: 'Failed to fetch user profile'
            });
        }
    }

    /**
     * Update user profile
     * PUT /api/auth/profile
     */
    async updateProfile(req, res) {
        try {
            const user = req.user;
            const { name, preferences } = req.body;

            // Update allowed fields
            if (name && typeof name === 'string') {
                user.name = name.trim();
            }

            if (preferences && typeof preferences === 'object') {
                // Update language preference
                if (preferences.language && ['ru', 'uz', 'en'].includes(preferences.language)) {
                    user.preferences.language = preferences.language;
                }

                // Update notification preferences
                if (preferences.notifications && typeof preferences.notifications === 'object') {
                    if (typeof preferences.notifications.email === 'boolean') {
                        user.preferences.notifications.email = preferences.notifications.email;
                    }
                    if (typeof preferences.notifications.browser === 'boolean') {
                        user.preferences.notifications.browser = preferences.notifications.browser;
                    }
                }

                // Update default template
                if (preferences.defaultTemplate) {
                    user.preferences.defaultTemplate = preferences.defaultTemplate;
                }
            }

            await user.save();

            global.logger.logInfo(`Profile updated for user: ${user.email}`);

            res.json({
                success: true,
                message: 'Profile updated successfully',
                user: {
                    id: user._id,
                    email: user.email,
                    name: user.name,
                    picture: user.picture,
                    subscriptionType: user.subscriptionType,
                    preferences: user.preferences
                }
            });

        } catch (error) {
            global.logger.logError('Error updating user profile:', error);
            res.status(500).json({
                error: 'PROFILE_UPDATE_FAILED',
                message: 'Failed to update profile'
            });
        }
    }

    /**
     * Logout user
     * POST /api/auth/logout
     */
    async logout(req, res) {
        try {
            const token = req.token;
            const user = req.user;

            // Revoke the current access token
            if (token) {
                // Calculate token expiration time for blacklist
                const decoded = await authService.verifyAccessToken(token);
                const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);

                if (expiresIn > 0) {
                    await authService.revokeToken(token, expiresIn);
                }
            }

            global.logger.logInfo(`User logged out: ${user?.email || 'Unknown'}`);

            res.json({
                success: true,
                message: 'Logged out successfully'
            });

        } catch (error) {
            global.logger.logError('Error during logout:', error);
            // Don't fail logout even if token revocation fails
            res.json({
                success: true,
                message: 'Logged out successfully'
            });
        }
    }

    /**
     * Health check for auth service
     * GET /api/auth/health
     */
    async healthCheck(req, res) {
        try {
            res.json({
                success: true,
                service: 'auth',
                status: 'healthy',
                timestamp: new Date().toISOString(),
                features: {
                    googleOAuth: !!process.env.GOOGLE_CLIENT_ID,
                    jwtAuth: !!process.env.JWT_SECRET,
                    tokenRefresh: !!process.env.JWT_REFRESH_SECRET
                }
            });
        } catch (error) {
            global.logger.logError('Auth health check failed:', error);
            res.status(500).json({
                success: false,
                service: 'auth',
                status: 'unhealthy',
                error: error.message
            });
        }
    }
}

module.exports = new AuthController();