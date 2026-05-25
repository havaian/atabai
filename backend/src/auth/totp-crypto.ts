import * as crypto from 'crypto';

/**
 * TOTP encryption helpers — AES-256-GCM with a key from TOTP_ENCRYPTION_KEY.
 *
 * Stored ciphertext format: "ivHex:authTagHex:ciphertextHex".
 *
 * Ported from backend/src/admin/totpCrypto.js. We deliberately throw when the
 * key is missing rather than generating one on the fly: a generated key would
 * be lost on restart and silently brick every enrolled admin's 2FA.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

function getKey(): Buffer {
  const hex = process.env.TOTP_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      'TOTP_ENCRYPTION_KEY env var is required for 2FA. ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }
  const buf = Buffer.from(hex, 'hex');
  if (buf.length !== KEY_LENGTH) {
    throw new Error(
      `TOTP_ENCRYPTION_KEY must be ${KEY_LENGTH * 2} hex chars (${KEY_LENGTH} bytes), got ${buf.length} bytes`,
    );
  }
  return buf;
}

export function encrypt(plaintext: string): string {
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

export function decrypt(ciphertext: string): string {
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

export function isConfigured(): boolean {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}
