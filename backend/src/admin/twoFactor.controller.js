const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const bcrypt = require('bcryptjs');

const User = require('../user/model');
const AdminSession = require('./models/adminSession.model');
const totpCrypto = require('./totpCrypto');

const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours (per stage 5 decision)
const TOTP_ISSUER = 'ATABAI Admin';
const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_LENGTH = 10; // characters in each code

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newSessionId() {
    return crypto.randomBytes(32).toString('hex');
}

function generateBackupCode() {
    // Easy-to-read alphabet (no 0/O/1/I) -> 10 chars in groups of 5
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < BACKUP_CODE_LENGTH; i++) {
        s += alphabet[crypto.randomInt(0, alphabet.length)];
    }
    return `${s.slice(0, 5)}-${s.slice(5)}`;
}

async function hashBackupCodes(codes) {
    return Promise.all(codes.map(c => bcrypt.hash(c, 10)));
}

/**
 * Try to match a submitted backup code against the user's stored hashes.
 * Returns the index of the matched hash, or -1.
 * NOTE: returns first match; backup codes are random enough that collisions
 * are astronomically unlikely.
 */
async function findBackupCodeIndex(submitted, hashes) {
    const normalized = String(submitted || '').trim().toUpperCase();
    if (!normalized) return -1;
    for (let i = 0; i < hashes.length; i++) {
        if (await bcrypt.compare(normalized, hashes[i])) return i;
    }
    return -1;
}

async function createSession(user, req, method) {
    const session = await AdminSession.create({
        sessionId: newSessionId(),
        userId: user._id,
        userEmail: user.email,
        expiresAt: new Date(Date.now() + ADMIN_SESSION_TTL_MS),
        ip: req.ip || null,
        userAgent: req.get('User-Agent') || null,
        method
    });
    return session;
}

// ─── Endpoints ────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/2fa/status
 * Reports whether the current admin has TOTP enabled.
 */
async function getStatus(req, res) {
    res.json({
        success: true,
        totpEnabled: !!req.user.totpEnabled,
        totpEnabledAt: req.user.totpEnabledAt || null,
        encryptionConfigured: totpCrypto.isConfigured()
    });
}

/**
 * POST /api/admin/2fa/setup
 * Begin enrollment: generates a fresh TOTP secret (NOT yet activated),
 * stores it encrypted on the user, and returns the otpauth URL + QR data URL.
 *
 * If the user already has TOTP enabled, returns 409 — they must disable first.
 *
 * The secret is stored on the user from this moment so the same QR can be
 * scanned across page refreshes. It is only "activated" once the user
 * successfully submits a valid code via /confirm.
 */
async function setup(req, res) {
    try {
        if (!totpCrypto.isConfigured()) {
            return res.status(500).json({
                error: 'ENCRYPTION_NOT_CONFIGURED',
                message: 'TOTP_ENCRYPTION_KEY is not set on the server'
            });
        }

        if (req.user.totpEnabled) {
            return res.status(409).json({
                error: 'ALREADY_ENABLED',
                message: '2FA is already enabled. Disable it first to re-enroll.'
            });
        }

        const secret = speakeasy.generateSecret({
            name: `${TOTP_ISSUER} (${req.user.email})`,
            issuer: TOTP_ISSUER,
            length: 20
        });

        // Encrypt and store the base32 secret. Not yet activated.
        const encrypted = totpCrypto.encrypt(secret.base32);

        // Need to fetch the user with totpSecret/totpBackupCodes selected to save them
        const userDoc = await User.findById(req.user._id)
            .select('+totpSecret +totpBackupCodes +refreshTokenSecret');
        userDoc.totpSecret = encrypted;
        userDoc.totpEnabled = false;       // explicit — not active until /confirm
        userDoc.totpEnabledAt = null;
        userDoc.totpBackupCodes = [];       // cleared until /confirm regenerates
        await userDoc.save();

        const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url, { margin: 1, width: 256 });

        global.logger.logSecurity('2FA setup initiated', {
            adminId: req.user._id,
            adminEmail: req.user.email
        }, 'info');

        res.json({
            success: true,
            otpauthUrl: secret.otpauth_url,
            qrDataUrl,
            // We do NOT return the base32 secret in plaintext to discourage
            // manual entry shortcuts — admins should scan the QR.
            // If absolutely needed for manual entry, expose via a separate
            // flag-protected endpoint.
            issuer: TOTP_ISSUER
        });
    } catch (err) {
        global.logger.logError(err, { context: 'admin/2fa/setup' });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to start 2FA setup' });
    }
}

/**
 * POST /api/admin/2fa/confirm
 * Body: { code: "123456" }
 *
 * Verifies the submitted TOTP code against the secret stored at /setup time.
 * On success: activates 2FA, generates backup codes, and returns them ONCE.
 * Also creates an AdminSession immediately (so the admin doesn't have to verify
 * a second time right after enrolling).
 */
async function confirm(req, res) {
    try {
        const { code } = req.body || {};
        if (!code) {
            return res.status(400).json({ error: 'CODE_REQUIRED', message: 'Code is required' });
        }

        const userDoc = await User.findById(req.user._id)
            .select('+totpSecret +totpBackupCodes +refreshTokenSecret');

        if (!userDoc.totpSecret) {
            return res.status(400).json({
                error: 'NO_SETUP_IN_PROGRESS',
                message: 'No 2FA setup is in progress. Call /setup first.'
            });
        }

        if (userDoc.totpEnabled) {
            return res.status(409).json({
                error: 'ALREADY_ENABLED',
                message: '2FA is already enabled'
            });
        }

        let secretBase32;
        try {
            secretBase32 = totpCrypto.decrypt(userDoc.totpSecret);
        } catch (decErr) {
            global.logger.logError(decErr, { context: 'admin/2fa/confirm - decrypt failed', userId: userDoc._id });
            return res.status(500).json({
                error: 'DECRYPT_FAILED',
                message: 'Failed to decrypt TOTP secret. Encryption key may have changed.'
            });
        }

        const verified = speakeasy.totp.verify({
            secret: secretBase32,
            encoding: 'base32',
            token: String(code).trim(),
            window: 1
        });

        if (!verified) {
            return res.status(400).json({ error: 'INVALID_CODE', message: 'Invalid code' });
        }

        // Generate backup codes (returned plaintext ONCE; stored hashed)
        const backupCodes = [];
        for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
            backupCodes.push(generateBackupCode());
        }
        const hashed = await hashBackupCodes(backupCodes);

        userDoc.totpEnabled = true;
        userDoc.totpEnabledAt = new Date();
        userDoc.totpBackupCodes = hashed;
        await userDoc.save();

        const session = await createSession(userDoc, req, 'totp');

        global.logger.logSecurity('2FA enrollment completed', {
            adminId: userDoc._id,
            adminEmail: userDoc.email,
            backupCodesIssued: backupCodes.length
        }, 'info');

        res.json({
            success: true,
            totpEnabled: true,
            // Backup codes are returned EXACTLY ONCE. The admin must save them.
            backupCodes,
            adminSession: {
                sessionId: session.sessionId,
                expiresAt: session.expiresAt
            }
        });
    } catch (err) {
        global.logger.logError(err, { context: 'admin/2fa/confirm' });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to confirm 2FA' });
    }
}

/**
 * POST /api/admin/2fa/verify
 * Body: { code: "123456" }   — TOTP code OR backup code
 *
 * Validates a TOTP or backup code from an already-enrolled admin and creates
 * an AdminSession with 8h TTL. Returns the session id; the client must send
 * it in `X-Admin-Session` header on subsequent /api/admin/* requests.
 */
async function verify(req, res) {
    try {
        const { code } = req.body || {};
        if (!code) {
            return res.status(400).json({ error: 'CODE_REQUIRED', message: 'Code is required' });
        }

        const userDoc = await User.findById(req.user._id)
            .select('+totpSecret +totpBackupCodes +refreshTokenSecret');

        if (!userDoc.totpEnabled || !userDoc.totpSecret) {
            return res.status(409).json({
                error: 'NOT_ENROLLED',
                message: '2FA is not enabled for this account'
            });
        }

        const submitted = String(code).trim();

        // Try TOTP first
        let method = null;
        try {
            const secretBase32 = totpCrypto.decrypt(userDoc.totpSecret);
            const totpOk = speakeasy.totp.verify({
                secret: secretBase32,
                encoding: 'base32',
                token: submitted,
                window: 1
            });
            if (totpOk) method = 'totp';
        } catch (decErr) {
            global.logger.logError(decErr, { context: 'admin/2fa/verify - decrypt failed', userId: userDoc._id });
        }

        // Fall back to backup code
        if (!method && submitted.length >= 8) {
            const matchIdx = await findBackupCodeIndex(submitted, userDoc.totpBackupCodes);
            if (matchIdx >= 0) {
                // Consume the backup code
                userDoc.totpBackupCodes.splice(matchIdx, 1);
                await userDoc.save();
                method = 'backup_code';
            }
        }

        if (!method) {
            global.logger.logSecurity('2FA verification failed', {
                adminId: userDoc._id,
                adminEmail: userDoc.email
            }, 'warn');
            return res.status(400).json({ error: 'INVALID_CODE', message: 'Invalid code' });
        }

        const session = await createSession(userDoc, req, method);

        global.logger.logSecurity('2FA verification succeeded', {
            adminId: userDoc._id,
            adminEmail: userDoc.email,
            method,
            backupCodesRemaining: userDoc.totpBackupCodes.length
        }, 'info');

        res.json({
            success: true,
            adminSession: {
                sessionId: session.sessionId,
                expiresAt: session.expiresAt
            },
            method,
            backupCodesRemaining: userDoc.totpBackupCodes.length
        });
    } catch (err) {
        global.logger.logError(err, { context: 'admin/2fa/verify' });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to verify code' });
    }
}

/**
 * POST /api/admin/2fa/logout
 * Invalidates the current admin session (if any). Requires X-Admin-Session
 * header; if missing or expired, returns 204 anyway (idempotent).
 */
async function logoutSession(req, res) {
    try {
        const sid = req.get('X-Admin-Session');
        if (sid) {
            await AdminSession.deleteOne({ sessionId: sid, userId: req.user._id });
            global.logger.logSecurity('Admin session logged out', {
                adminId: req.user._id,
                adminEmail: req.user.email
            }, 'info');
        }
        res.status(204).end();
    } catch (err) {
        global.logger.logError(err, { context: 'admin/2fa/logout' });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to logout' });
    }
}

/**
 * POST /api/admin/2fa/disable
 * Body: { code: "123456" }   — current TOTP code required (no backup codes allowed)
 *
 * Disables 2FA on the admin's own account. Requires a valid TOTP code to
 * prove possession of the device — backup codes are NOT accepted here because
 * an attacker who stole only backup codes shouldn't be able to disable 2FA.
 *
 * Also invalidates all existing admin sessions for this user.
 */
async function disable(req, res) {
    try {
        const { code } = req.body || {};
        if (!code) {
            return res.status(400).json({ error: 'CODE_REQUIRED', message: 'TOTP code is required' });
        }

        const userDoc = await User.findById(req.user._id)
            .select('+totpSecret +totpBackupCodes +refreshTokenSecret');

        if (!userDoc.totpEnabled || !userDoc.totpSecret) {
            return res.status(409).json({ error: 'NOT_ENROLLED', message: '2FA is not enabled' });
        }

        const secretBase32 = totpCrypto.decrypt(userDoc.totpSecret);
        const ok = speakeasy.totp.verify({
            secret: secretBase32,
            encoding: 'base32',
            token: String(code).trim(),
            window: 1
        });
        if (!ok) {
            return res.status(400).json({ error: 'INVALID_CODE', message: 'Invalid TOTP code' });
        }

        userDoc.totpEnabled = false;
        userDoc.totpEnabledAt = null;
        userDoc.totpSecret = undefined;
        userDoc.totpBackupCodes = [];
        await userDoc.save();

        await AdminSession.deleteMany({ userId: userDoc._id });

        global.logger.logSecurity('2FA disabled', {
            adminId: userDoc._id,
            adminEmail: userDoc.email
        }, 'warn');

        res.json({ success: true });
    } catch (err) {
        global.logger.logError(err, { context: 'admin/2fa/disable' });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to disable 2FA' });
    }
}

/**
 * POST /api/admin/2fa/backup-codes/regenerate
 * Body: { code: "123456" }   — TOTP code required
 *
 * Discards all existing backup codes and issues a fresh set of 10.
 * Returns plaintext codes ONCE.
 */
async function regenerateBackupCodes(req, res) {
    try {
        const { code } = req.body || {};
        if (!code) {
            return res.status(400).json({ error: 'CODE_REQUIRED', message: 'TOTP code is required' });
        }

        const userDoc = await User.findById(req.user._id)
            .select('+totpSecret +totpBackupCodes +refreshTokenSecret');

        if (!userDoc.totpEnabled || !userDoc.totpSecret) {
            return res.status(409).json({ error: 'NOT_ENROLLED', message: '2FA is not enabled' });
        }

        const secretBase32 = totpCrypto.decrypt(userDoc.totpSecret);
        const ok = speakeasy.totp.verify({
            secret: secretBase32,
            encoding: 'base32',
            token: String(code).trim(),
            window: 1
        });
        if (!ok) {
            return res.status(400).json({ error: 'INVALID_CODE', message: 'Invalid TOTP code' });
        }

        const fresh = [];
        for (let i = 0; i < BACKUP_CODE_COUNT; i++) fresh.push(generateBackupCode());
        userDoc.totpBackupCodes = await hashBackupCodes(fresh);
        await userDoc.save();

        global.logger.logSecurity('2FA backup codes regenerated', {
            adminId: userDoc._id,
            adminEmail: userDoc.email
        }, 'info');

        res.json({ success: true, backupCodes: fresh });
    } catch (err) {
        global.logger.logError(err, { context: 'admin/2fa/regenerate' });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to regenerate backup codes' });
    }
}

module.exports = {
    getStatus,
    setup,
    confirm,
    verify,
    logoutSession,
    disable,
    regenerateBackupCodes,
    // Exported for middleware reuse
    ADMIN_SESSION_TTL_MS
};
