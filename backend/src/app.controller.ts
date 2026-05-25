import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

@Controller()
export class AppController {
  /**
   * Root info — preserved from the legacy Express handler.
   */
  @Get('/')
  @SkipThrottle()
  getRoot(): Record<string, string> {
    return {
      message: 'ATABAI API Server',
      version: '2.0.0',
      docs: '/api/docs',
      health: '/health',
    };
  }

  /**
   * Health endpoint — used by container orchestrators / load balancers.
   * Skips rate limiting because it's hit on a fast cadence by infra probes.
   */
  @Get('/health')
  @SkipThrottle()
  getHealth(): Record<string, unknown> {
    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '2.0.0',
    };
  }
}
