import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { Model, Types } from 'mongoose';
import * as QRCode from 'qrcode';
import * as speakeasy from 'speakeasy';

import { AppError } from '../common/errors/app.error';
import { AppLoggerService } from '../common/logger/app-logger.service';
import type { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { AdminSession, type AdminSessionDocument } from './schemas/admin-session.schema';
import * as totpCrypto from './totp-crypto';

const TOTP_ISSUER = 'ATABAI Admin';
const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_LENGTH = 10;
export const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export interface AdminSessionInfo {
  sessionId: string;
  expiresAt: Date;
}

/**
 * Service that owns the TOTP enrollment / verification flow and the
 * AdminSession lifecycle. The HTTP controller is thin — all the crypto
 * choreography lives here.
 */
@Injectable()
export class TwoFactorService {
  constructor(
    @InjectModel(AdminSession.name)
    private readonly sessionModel: Model<AdminSessionDocument>,
    private readonly users: UsersService,
    private readonly logger: AppLoggerService,
  ) {}

  // ─── Status ────────────────────────────────────────────────────────────────

  getStatus(user: UserDocument): {
    success: true;
    totpEnabled: boolean;
    totpEnabledAt: Date | null;
    encryptionConfigured: boolean;
  } {
    return {
      success: true,
      totpEnabled: !!user.totpEnabled,
      totpEnabledAt: user.totpEnabledAt ?? null,
      encryptionConfigured: totpCrypto.isConfigured(),
    };
  }

  // ─── Setup ─────────────────────────────────────────────────────────────────

  async setup(user: UserDocument): Promise<{
    success: true;
    otpauthUrl: string;
    qrDataUrl: string;
    issuer: string;
  }> {
    if (!totpCrypto.isConfigured()) {
      throw new AppError(
        'TOTP_ENCRYPTION_KEY is not set on the server',
        500,
        'ENCRYPTION_NOT_CONFIGURED',
      );
    }
    if (user.totpEnabled) {
      throw new AppError(
        '2FA is already enabled. Disable it first to re-enroll.',
        409,
        'ALREADY_ENABLED',
      );
    }

    const secret = speakeasy.generateSecret({
      name: `${TOTP_ISSUER} (${user.email})`,
      issuer: TOTP_ISSUER,
      length: 20,
    });

    const encrypted = totpCrypto.encrypt(secret.base32);

    const userDoc = await this.users.findByIdWithTotp(user._id);
    if (!userDoc) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    userDoc.totpSecret = encrypted;
    userDoc.totpEnabled = false;
    userDoc.totpEnabledAt = null;
    userDoc.totpBackupCodes = [];
    await userDoc.save();

    if (!secret.otpauth_url) {
      throw new AppError('Failed to generate otpauth URL', 500, 'INTERNAL_ERROR');
    }
    const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url, { margin: 1, width: 256 });

    this.logger.logSecurity(
      '2FA setup initiated',
      { adminId: user._id.toString(), adminEmail: user.email },
      'info',
    );

    return {
      success: true,
      otpauthUrl: secret.otpauth_url,
      qrDataUrl,
      issuer: TOTP_ISSUER,
    };
  }

  // ─── Confirm enrollment ─────────────────────────────────────────────────────

  async confirm(
    user: UserDocument,
    code: string,
    ip: string | null,
    userAgent: string | null,
  ): Promise<{
    success: true;
    totpEnabled: true;
    backupCodes: string[];
    adminSession: AdminSessionInfo;
  }> {
    if (!code) throw new AppError('Code is required', 400, 'CODE_REQUIRED');

    const userDoc = await this.users.findByIdWithTotp(user._id);
    if (!userDoc) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

    if (!userDoc.totpSecret) {
      throw new AppError(
        'No 2FA setup is in progress. Call /setup first.',
        400,
        'NO_SETUP_IN_PROGRESS',
      );
    }
    if (userDoc.totpEnabled) {
      throw new AppError('2FA is already enabled', 409, 'ALREADY_ENABLED');
    }

    let secretBase32: string;
    try {
      secretBase32 = totpCrypto.decrypt(userDoc.totpSecret);
    } catch (err) {
      this.logger.error(err, { context: 'two-factor/confirm decrypt', userId: userDoc._id });
      throw new AppError(
        'Failed to decrypt TOTP secret. Encryption key may have changed.',
        500,
        'DECRYPT_FAILED',
      );
    }

    const verified = speakeasy.totp.verify({
      secret: secretBase32,
      encoding: 'base32',
      token: code.trim(),
      window: 1,
    });
    if (!verified) throw new AppError('Invalid code', 400, 'INVALID_CODE');

    const backupCodes = Array.from({ length: BACKUP_CODE_COUNT }, () => this.generateBackupCode());
    const hashed = await this.hashBackupCodes(backupCodes);

    userDoc.totpEnabled = true;
    userDoc.totpEnabledAt = new Date();
    userDoc.totpBackupCodes = hashed;
    await userDoc.save();

    const session = await this.createSession(userDoc, ip, userAgent, 'totp');

    this.logger.logSecurity(
      '2FA enrollment completed',
      {
        adminId: userDoc._id.toString(),
        adminEmail: userDoc.email,
        backupCodesIssued: backupCodes.length,
      },
      'info',
    );

    return {
      success: true,
      totpEnabled: true,
      backupCodes,
      adminSession: { sessionId: session.sessionId, expiresAt: session.expiresAt },
    };
  }

  // ─── Verify (login flow) ───────────────────────────────────────────────────

  async verify(
    user: UserDocument,
    code: string,
    ip: string | null,
    userAgent: string | null,
  ): Promise<{
    success: true;
    adminSession: AdminSessionInfo;
    method: 'totp' | 'backup_code';
    backupCodesRemaining: number;
  }> {
    if (!code) throw new AppError('Code is required', 400, 'CODE_REQUIRED');

    const userDoc = await this.users.findByIdWithTotp(user._id);
    if (!userDoc) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

    if (!userDoc.totpEnabled || !userDoc.totpSecret) {
      throw new AppError('2FA is not enabled for this account', 409, 'NOT_ENROLLED');
    }

    const submitted = String(code).trim();
    let method: 'totp' | 'backup_code' | null = null;

    // TOTP first
    try {
      const secretBase32 = totpCrypto.decrypt(userDoc.totpSecret);
      const totpOk = speakeasy.totp.verify({
        secret: secretBase32,
        encoding: 'base32',
        token: submitted,
        window: 1,
      });
      if (totpOk) method = 'totp';
    } catch (err) {
      this.logger.error(err, { context: 'two-factor/verify decrypt', userId: userDoc._id });
    }

    // Fall back to backup code
    if (!method && submitted.length >= 8 && userDoc.totpBackupCodes) {
      const matchIdx = await this.findBackupCodeIndex(submitted, userDoc.totpBackupCodes);
      if (matchIdx >= 0) {
        userDoc.totpBackupCodes.splice(matchIdx, 1);
        await userDoc.save();
        method = 'backup_code';
      }
    }

    if (!method) {
      this.logger.logSecurity(
        '2FA verification failed',
        { adminId: userDoc._id.toString(), adminEmail: userDoc.email },
        'warn',
      );
      throw new AppError('Invalid code', 400, 'INVALID_CODE');
    }

    const session = await this.createSession(userDoc, ip, userAgent, method);

    this.logger.logSecurity(
      '2FA verification succeeded',
      {
        adminId: userDoc._id.toString(),
        adminEmail: userDoc.email,
        method,
        backupCodesRemaining: userDoc.totpBackupCodes?.length ?? 0,
      },
      'info',
    );

    return {
      success: true,
      adminSession: { sessionId: session.sessionId, expiresAt: session.expiresAt },
      method,
      backupCodesRemaining: userDoc.totpBackupCodes?.length ?? 0,
    };
  }

  // ─── Logout (idempotent) ───────────────────────────────────────────────────

  async logoutSession(user: UserDocument, sessionId: string | undefined): Promise<void> {
    if (!sessionId) return;
    await this.sessionModel.deleteOne({ sessionId, userId: user._id });
    this.logger.logSecurity(
      'Admin session logged out',
      { adminId: user._id.toString(), adminEmail: user.email },
      'info',
    );
  }

  // ─── Disable ───────────────────────────────────────────────────────────────

  async disable(user: UserDocument, code: string): Promise<{ success: true }> {
    if (!code) throw new AppError('TOTP code is required', 400, 'CODE_REQUIRED');

    const userDoc = await this.users.findByIdWithTotp(user._id);
    if (!userDoc) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

    if (!userDoc.totpEnabled || !userDoc.totpSecret) {
      throw new AppError('2FA is not enabled', 409, 'NOT_ENROLLED');
    }

    const secretBase32 = totpCrypto.decrypt(userDoc.totpSecret);
    const ok = speakeasy.totp.verify({
      secret: secretBase32,
      encoding: 'base32',
      token: code.trim(),
      window: 1,
    });
    if (!ok) throw new AppError('Invalid TOTP code', 400, 'INVALID_CODE');

    userDoc.totpEnabled = false;
    userDoc.totpEnabledAt = null;
    userDoc.totpSecret = undefined;
    userDoc.totpBackupCodes = [];
    await userDoc.save();

    await this.sessionModel.deleteMany({ userId: userDoc._id });

    this.logger.logSecurity(
      '2FA disabled',
      { adminId: userDoc._id.toString(), adminEmail: userDoc.email },
      'warn',
    );

    return { success: true };
  }

  // ─── Backup-code regeneration ───────────────────────────────────────────────

  async regenerateBackupCodes(
    user: UserDocument,
    code: string,
  ): Promise<{ success: true; backupCodes: string[] }> {
    if (!code) throw new AppError('TOTP code is required', 400, 'CODE_REQUIRED');

    const userDoc = await this.users.findByIdWithTotp(user._id);
    if (!userDoc) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

    if (!userDoc.totpEnabled || !userDoc.totpSecret) {
      throw new AppError('2FA is not enabled', 409, 'NOT_ENROLLED');
    }

    const secretBase32 = totpCrypto.decrypt(userDoc.totpSecret);
    const ok = speakeasy.totp.verify({
      secret: secretBase32,
      encoding: 'base32',
      token: code.trim(),
      window: 1,
    });
    if (!ok) throw new AppError('Invalid TOTP code', 400, 'INVALID_CODE');

    const fresh = Array.from({ length: BACKUP_CODE_COUNT }, () => this.generateBackupCode());
    userDoc.totpBackupCodes = await this.hashBackupCodes(fresh);
    await userDoc.save();

    this.logger.logSecurity(
      '2FA backup codes regenerated',
      { adminId: userDoc._id.toString(), adminEmail: userDoc.email },
      'info',
    );

    return { success: true, backupCodes: fresh };
  }

  // ─── Used by AdminVerifiedGuard ─────────────────────────────────────────────

  async findSession(sessionId: string): Promise<AdminSessionDocument | null> {
    return this.sessionModel.findOne({ sessionId }).exec();
  }

  async deleteSessionById(id: Types.ObjectId): Promise<void> {
    await this.sessionModel.deleteOne({ _id: id });
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async createSession(
    user: UserDocument,
    ip: string | null,
    userAgent: string | null,
    method: 'totp' | 'backup_code',
  ): Promise<AdminSessionDocument> {
    return this.sessionModel.create({
      sessionId: this.newSessionId(),
      userId: user._id,
      userEmail: user.email,
      expiresAt: new Date(Date.now() + ADMIN_SESSION_TTL_MS),
      ip,
      userAgent,
      method,
    });
  }

  private newSessionId(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private generateBackupCode(): string {
    // Easy-to-read alphabet (no 0/O/1/I), grouped as "XXXXX-XXXXX".
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < BACKUP_CODE_LENGTH; i++) {
      s += alphabet[crypto.randomInt(0, alphabet.length)];
    }
    return `${s.slice(0, 5)}-${s.slice(5)}`;
  }

  private async hashBackupCodes(codes: string[]): Promise<string[]> {
    return Promise.all(codes.map((c) => bcrypt.hash(c, 10)));
  }

  private async findBackupCodeIndex(submitted: string, hashes: string[]): Promise<number> {
    const normalized = String(submitted || '').trim().toUpperCase();
    if (!normalized) return -1;
    for (let i = 0; i < hashes.length; i++) {
      if (await bcrypt.compare(normalized, hashes[i])) return i;
    }
    return -1;
  }
}
