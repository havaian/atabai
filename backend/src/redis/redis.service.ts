import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

import type { AppConfig } from '../config/configuration';

/**
 * Token used to inject the raw Redis client into other services that need
 * non-cache operations (pubsub, streams, etc.). Most code should use the
 * `cache` helpers on RedisService directly.
 */
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/**
 * Centralized Redis client + cache helpers.
 *
 * Ports the legacy `config/redis.js` connect/disconnect/healthCheck/cache surface
 * onto Nest lifecycle hooks. Failures in `connect` are non-fatal — the legacy
 * backend boots even when Redis is unreachable (cache is treated as optional).
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClientType | null = null;
  private connected = false;

  constructor(@Inject(ConfigService) private readonly configService: ConfigService<AppConfig, true>) {}

  async onModuleInit(): Promise<void> {
    const redis = this.configService.get('redis', { infer: true });
    const url = (() => {
      const auth = redis.password ? `:${encodeURIComponent(redis.password)}@` : '';
      const db = redis.database !== undefined ? `/${redis.database}` : '';
      return `redis://${auth}${redis.host}:${redis.port}${db}`;
    })();

    this.client = createClient({
      url,
      socket: { connectTimeout: 10_000, keepAlive: true },
    }) as RedisClientType;

    this.client.on('connect', () => this.logger.debug('Redis connecting...'));
    this.client.on('ready', () => {
      this.connected = true;
      this.logger.log(`Redis ready (${redis.host}:${redis.port})`);
    });
    this.client.on('error', (err: Error) => this.logger.error(`Redis error: ${err.message}`));
    this.client.on('end', () => {
      this.connected = false;
      this.logger.warn('Redis connection ended');
    });
    this.client.on('reconnecting', () => this.logger.log('Redis reconnecting...'));

    try {
      await this.client.connect();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Non-fatal — match legacy behavior where Redis is optional at boot
      this.logger.warn(`Redis connection failed at startup (will retry on first use): ${message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client?.isOpen) {
      try {
        await this.client.quit();
        this.logger.log('Redis disconnected gracefully');
      } catch (err) {
        this.logger.error(`Error disconnecting Redis: ${(err as Error).message}`);
      }
    }
  }

  /** Throws if the client is not yet ready — used by callers that require Redis. */
  getClient(): RedisClientType {
    if (!this.client) throw new Error('Redis client not initialized');
    return this.client;
  }

  isReady(): boolean {
    return this.connected && (this.client?.isOpen ?? false);
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; error?: string }> {
    try {
      if (!this.client?.isOpen) throw new Error('Redis not connected');
      const pong = await this.client.ping();
      if (pong !== 'PONG') throw new Error('Unexpected ping reply');
      return { status: 'healthy' };
    } catch (err) {
      return { status: 'unhealthy', error: (err as Error).message };
    }
  }

  // ---------------------------------------------------------------------------
  // Cache helpers — fail-soft on read, throw on write so callers can choose.
  // ---------------------------------------------------------------------------

  async cacheSet(key: string, value: unknown, ttlSeconds = 3600): Promise<void> {
    if (!this.client?.isOpen) return;
    const payload = JSON.stringify(value);
    if (ttlSeconds > 0) await this.client.setEx(key, ttlSeconds, payload);
    else await this.client.set(key, payload);
  }

  async cacheGet<T = unknown>(key: string): Promise<T | null> {
    if (!this.client?.isOpen) return null;
    try {
      const value = await this.client.get(key);
      if (value === null) return null;
      return JSON.parse(value) as T;
    } catch (err) {
      this.logger.warn(`Cache GET error on key "${key}": ${(err as Error).message}`);
      return null;
    }
  }

  async cacheDel(key: string): Promise<number> {
    if (!this.client?.isOpen) return 0;
    try {
      return await this.client.del(key);
    } catch {
      return 0;
    }
  }

  async cacheExists(key: string): Promise<boolean> {
    if (!this.client?.isOpen) return false;
    try {
      return (await this.client.exists(key)) === 1;
    } catch {
      return false;
    }
  }

  async cacheExpire(key: string, ttlSeconds: number): Promise<void> {
    if (!this.client?.isOpen) return;
    try {
      await this.client.expire(key, ttlSeconds);
    } catch (err) {
      this.logger.warn(`Cache EXPIRE error on key "${key}": ${(err as Error).message}`);
    }
  }

  async cacheIncr(key: string): Promise<number> {
    if (!this.client?.isOpen) return 0;
    try {
      return await this.client.incr(key);
    } catch {
      return 0;
    }
  }
}
