// backend/src/config/subscription.js
const FILE_PROCESSING_LIMITS = {
    basic: 3,
    premium: Infinity,
    enterprise: Infinity
};

/**
 * Get file processing limit for subscription type
 * @param {string} subscriptionType - Subscription type
 * @returns {Promise<number>} File processing limit
 */
const getFileLimit = async (subscriptionType) => {
    return FILE_PROCESSING_LIMITS[subscriptionType] || FILE_PROCESSING_LIMITS.basic;
};

module.exports = {
    FILE_PROCESSING_LIMITS,
    getFileLimit
};