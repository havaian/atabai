import { Global, Module } from '@nestjs/common';

import { RedisService } from './redis.service';

/**
 * Global Redis module - RedisService is available everywhere without
 * re-importing.
 */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
