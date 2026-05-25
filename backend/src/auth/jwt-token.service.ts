import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

import type { AppConfig } from '../config/configuration';
import type { IUserMethods, UserDocument } from '../users/schemas/user.schema';

export interface AccessTokenPayload {
  userId: string;
  email: string;
  subscriptionType: string;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  userId: string;
  type: 'refresh';
  iat?: number;
  exp?: number;
}

export type DecodedToken = AccessTokenPayload | RefreshTokenPayload;

/**
 * Token signing + verification using the per-user refresh secret rotation
 * pattern from backend/src/services/auth.js.
 *
 * Each user has their own JWT signing secret stored on the User document.
 * That gives us free per-user revocation: regenerate the secret and every
 * outstanding token for that user is invalidated.
 */
@Injectable()
export class JwtTokenService {
  private readonly accessExpiresIn: string;
  private readonly refreshExpiresIn: string;

  constructor(private readonly configService: ConfigService<AppConfig, true>) {
    const jwtCfg = configService.get('jwt', { infer: true });
    this.accessExpiresIn = jwtCfg.accessExpiresIn;
    this.refreshExpiresIn = jwtCfg.refreshExpiresIn;
  }

  async generateAccessToken(user: UserDocument): Promise<string> {
    const secret = await (user as unknown as IUserMethods).getRefreshTokenSecret();
    const payload: AccessTokenPayload = {
      userId: user._id.toString(),
      email: user.email,
      subscriptionType: user.subscriptionType,
      iat: Math.floor(Date.now() / 1000),
    };
    return jwt.sign(payload, secret, {
      expiresIn: this.accessExpiresIn as jwt.SignOptions['expiresIn'],
      issuer: 'atabai-api',
      audience: 'atabai-client',
    });
  }

  async generateRefreshToken(user: UserDocument): Promise<string> {
    const secret = await (user as unknown as IUserMethods).getRefreshTokenSecret();
    const payload: RefreshTokenPayload = {
      userId: user._id.toString(),
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000),
    };
    return jwt.sign(payload, secret, {
      expiresIn: this.refreshExpiresIn as jwt.SignOptions['expiresIn'],
      issuer: 'atabai-api',
      audience: 'atabai-client',
    });
  }

  async generateTokenPair(user: UserDocument): Promise<{ accessToken: string; refreshToken: string }> {
    // Ensure secret is loaded before parallelizing.
    await (user as unknown as IUserMethods).getRefreshTokenSecret();
    const [accessToken, refreshToken] = await Promise.all([
      this.generateAccessToken(user),
      this.generateRefreshToken(user),
    ]);
    return { accessToken, refreshToken };
  }

  async verifyAccessToken(token: string, user: UserDocument): Promise<AccessTokenPayload> {
    const secret = await (user as unknown as IUserMethods).getRefreshTokenSecret();
    try {
      return jwt.verify(token, secret, {
        issuer: 'atabai-api',
        audience: 'atabai-client',
      }) as AccessTokenPayload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) throw new Error('ACCESS_TOKEN_EXPIRED');
      if (err instanceof jwt.JsonWebTokenError) throw new Error('INVALID_ACCESS_TOKEN');
      throw new Error('TOKEN_VERIFICATION_FAILED');
    }
  }

  async verifyRefreshToken(token: string, user: UserDocument): Promise<RefreshTokenPayload> {
    const secret = await (user as unknown as IUserMethods).getRefreshTokenSecret();
    try {
      const decoded = jwt.verify(token, secret, {
        issuer: 'atabai-api',
        audience: 'atabai-client',
      }) as RefreshTokenPayload;
      if (decoded.type !== 'refresh') throw new Error('INVALID_REFRESH_TOKEN');
      return decoded;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) throw new Error('REFRESH_TOKEN_EXPIRED');
      if (err instanceof jwt.JsonWebTokenError) throw new Error('INVALID_REFRESH_TOKEN');
      throw new Error('TOKEN_VERIFICATION_FAILED');
    }
  }

  /** Decode without verifying — used to extract userId before we know which secret to use. */
  decode(token: string): { userId?: string; type?: string; exp?: number } | null {
    try {
      const decoded = jwt.decode(token);
      if (!decoded || typeof decoded === 'string') return null;
      return decoded as { userId?: string; type?: string; exp?: number };
    } catch {
      return null;
    }
  }

  extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader) return null;
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
    return parts[1];
  }

  // Placeholder for Redis-backed token blacklist — preserved from legacy stub.
  async isTokenBlacklisted(_token: string): Promise<boolean> {
    return false;
  }

  async revokeToken(_token: string, _expiresInSeconds: number): Promise<void> {
    // TODO: implement Redis-backed blacklist once tokenized revocation is required.
    return Promise.resolve();
  }
}
