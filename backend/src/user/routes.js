const express = require('express');
const { authenticateJWT } = require('../middleware/auth');

const router = express.Router();

/**
 * @route   GET /api/users/me
 * @desc    Get current user info (alias for profile)
 * @access  Private
 */
router.get('/me', authenticateJWT, (req, res) => {
    res.json({
        success: true,
        user: {
            id: req.user._id,
            email: req.user.email,
            name: req.user.name,
            picture: req.user.picture,
            subscriptionType: req.user.subscriptionType,
            preferences: req.user.preferences
        }
    });
});

/**
 * @route   GET /api/users/stats
 * @desc    Get user statistics
 * @access  Private
 */
router.get('/stats', authenticateJWT, (req, res) => {
    res.json({
        success: true,
        stats: {
            filesProcessedThisMonth: req.user.filesProcessedThisMonth,
            monthlyLimit: req.user.subscriptionType === 'basic' ? 5 : 'unlimited',
            subscriptionType: req.user.subscriptionType,
            canProcessFiles: req.user.canProcessFiles(),
            memberSince: req.user.createdAt
        }
    });
});

/**
 * @route   PATCH /api/users/preferences
 * @desc    Update user preferences
 * @access  Private
 */
router.patch('/preferences', authenticateJWT, async (req, res) => {
    try {
        const { preferences } = req.body;
        
        // Update preferences
        if (preferences.language) req.user.preferences.language = preferences.language;
        if (preferences.theme) req.user.preferences.theme = preferences.theme;
        if (preferences.defaultTemplate !== undefined) req.user.preferences.defaultTemplate = preferences.defaultTemplate;
        if (preferences.notifications) Object.assign(req.user.preferences.notifications, preferences.notifications);
        
        await req.user.save();
        
        res.json({
            success: true,
            message: 'Preferences updated successfully',
            preferences: req.user.preferences
        });
    } catch (error) {
        console.error('Update preferences error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update preferences'
        });
    }
});

module.exports = router;