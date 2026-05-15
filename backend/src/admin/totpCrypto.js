/**
 * TOTP encryption helpers.
 *
 * The TOTP secret is encrypted at rest using AES-256-GCM. The key comes from
 * ENV TOTP_ENCRYPTION_KEY (hex-encoded 32 bytes / 64 hex chars).
 *
 * Format of stored ciphertext: `${ivHex}:${authTagHex}:${ciphertextHex}`.
 *
 * If the ENV key is missing, encryption operations throw — this is intentional:
 * we never want to silently store TOTP secrets in plaintext or generate
 * a key on the fly that would be lost on restart.
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM standard
const KEY_LENGTH = 32;

function getKey() {
    const hex = process.env.TOTP_ENCRYPTION_KEY;
    if (!hex) {
        throw new Error(
            'TOTP_ENCRYPTION_KEY env var is required for 2FA. ' +
            'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
        );
    }
    const buf = Buffer.from(hex, 'hex');
    if (buf.length !== KEY_LENGTH) {
        throw new Error(`TOTP_ENCRYPTION_KEY must be ${KEY_LENGTH * 2} hex chars (${KEY_LENGTH} bytes), got ${buf.length} bytes`);
    }
    return buf;
}

/**
 * Encrypt a plaintext string. Returns "ivHex:authTagHex:ciphertextHex".
 */
function encrypt(plaintext) {
    if (typeof plaintext !== 'string' || !plaintext) {
        throw new Error('encrypt: plaintext must be a non-empty string');
    }
    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${enc.toString('hex')}`;
}

/**
 * Decrypt a ciphertext produced by encrypt(). Returns plaintext or throws.
 */
function decrypt(ciphertext) {
    if (typeof ciphertext !== 'string' || !ciphertext) {
        throw new Error('decrypt: ciphertext must be a non-empty string');
    }
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
        throw new Error('decrypt: malformed ciphertext (expected ivHex:authTagHex:ciphertextHex)');
    }
    const [ivHex, authTagHex, encHex] = parts;
    const key = getKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const enc = Buffer.from(encHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return dec.toString('utf8');
}

/**
 * Check whether the ENV key is available without throwing.
 * Used by health/setup endpoints to surface configuration errors clearly.
 */
function isConfigured() {
    try {
        getKey();
        return true;
    } catch {
        return false;
    }
}

module.exports = {
    encrypt,
    decrypt,
    isConfigured
};
