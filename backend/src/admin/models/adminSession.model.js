const mongoose = require('mongoose');

/**
 * AdminSession — short-lived record proving that an admin has passed TOTP
 * verification within the current admin-area session.
 *
 * Created when admin POSTs a valid TOTP code (or backup code) to
 * /api/admin/2fa/verify. Required (via requireAdminVerified middleware) for
 * any /api/admin/* route that performs reads or mutations.
 *
 * MongoDB removes the document automatically once `expiresAt` is in the past
 * (TTL index). The route layer also rejects sessions whose `expiresAt` is past
 * without waiting for the sweeper — the index just keeps the collection clean.
 *
 * Session id is a random opaque token returned to the client; client sends it
 * back in the `X-Admin-Session` header on subsequent admin requests.
 */
const adminSessionSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    // Snapshot for cheap auditing — actual auth check goes through req.user.
    userEmail: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date,
        required: true,
        // TTL: MongoDB will delete the doc once `expiresAt` passes.
        index: { expireAfterSeconds: 0 }
    },
    // For optional binding to client context (logged but not enforced strictly).
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
    // Method used to authenticate this session ('totp' | 'backup_code')
    method: {
        type: String,
        enum: ['totp', 'backup_code'],
        required: true
    }
});

module.exports = mongoose.model('AdminSession', adminSessionSchema);
