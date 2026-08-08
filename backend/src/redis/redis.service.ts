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
 * Behavior parity with the legacy `config/redis.js`: Redis is OPTIONAL. The
 * legacy backend had `await connectRedis()` commented out in src/index.js,
 * so production was running without Redis. Cache helpers fail-soft (return
 * null/0/false), so nothing breaks.
 *
 * Connection policy:
 *   - Skipped entirely when REDIS_ENABLED=false (or unset). No client created,
 *     no log noise.
 *   - When enabled, we attempt one connect with a short retry budget. If the
 *     server is unreachable we mark Redis disabled for the rest of the process
 *     lifetime - no infinite reconnect spam. To re-enable, restart the app
 *     after starting Redis.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClientType | null = null;
  private connected = false;
  private enabled = false;

  constructor(@Inject(ConfigService) private readonly configService: ConfigService<AppConfig, true>) {}

  async onModuleInit(): Promise<void> {
    const features = this.configService.get('features', { infer: true });
    // `features.redis` doesn't exist on AppConfig today - we read REDIS_ENABLED
    // directly from process.env so the toggle works without a config-schema
    // change. Default: disabled, matching legacy production behavior.
    const explicitly = String(process.env.REDIS_ENABLED ?? '').toLowerCase();
    this.enabled = explicitly === 'true';

    if (!this.enabled) {
      this.logger.log('Redis disabled (REDIS_ENABLED != true) - cache helpers will fail-soft');
      void features; // silence unused
      return;
    }

    const redis = this.configService.get('redis', { infer: true });

    this.client = createClient({
      // `redis.uri` honors REDIS_URI when set, otherwise it's assembled from the
      // REDIS_HOST/REDIS_PORT/REDIS_PASSWORD/REDIS_DATABASE parts. Building it
      // in one place (config) means the resolver doesn't have two code paths.
      url: redis.uri,
      socket: {
        connectTimeout: 10_000,
        keepAlive: true,
        // Bounded reconnect: try up to 5 times with linear backoff (100ms, 200ms,
        // …, 500ms), then give up. Without a cap, the client retries forever and
        // floods logs. Returning Error stops the loop and surfaces a single
        // 'error' event we already log.
        reconnectStrategy: (retries) => {
          if (retries >= 5) {
            this.logger.warn('Redis: max reconnect attempts reached; giving up');
            return new Error('Redis unreachable - gave up after 5 retries');
          }
          return Math.min(100 * (retries + 1), 500);
        },
      },
    }) as RedisClientType;

    this.client.on('connect', () => this.logger.debug('Redis connecting...'));
    this.client.on('ready', () => {
      this.connected = true;
      this.logger.log(`Redis ready (${redis.host}:${redis.port})`);
    });
    // Only log the *first* error; subsequent errors during the bounded retry
    // window are noise.
    let errorLogged = false;
    this.client.on('error', (err: Error) => {
      if (!errorLogged) {
        this.logger.error(`Redis error: ${err.message}`);
        errorLogged = true;
      }
    });
    this.client.on('end', () => {
      this.connected = false;
      this.logger.warn('Redis connection ended');
    });
    this.client.on('reconnecting', () => this.logger.debug('Redis reconnecting...'));

    try {
      await this.client.connect();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Redis connection failed at startup: ${message}. Continuing without cache.`);
      // Discard the client so cache helpers cleanly fail-soft instead of
      // queuing operations against a perpetually-disconnected client.
      try {
        await this.client?.disconnect();
      } catch {
        /* ignore */
      }
      this.client = null;
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

  /** Throws if the client is not yet ready - used by callers that require Redis. */
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
  // Cache helpers - fail-soft on every operation so callers don't need to
  // branch on Redis availability. When Redis is disabled or unreachable, gets
  // return null, dels/incrs return 0, sets are no-ops.
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
