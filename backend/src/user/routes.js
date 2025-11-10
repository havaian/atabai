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

module.exports = router;