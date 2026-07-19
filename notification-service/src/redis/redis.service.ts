import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import logger from '../../logger';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  public pubClient: Redis;
  public subClient: Redis;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    try {
      const redisUrl = this.config.get<string>('REDIS_URL');
      this.pubClient = new Redis(redisUrl);
      this.subClient = this.pubClient.duplicate();
      logger.info('Redis clients connected for Socket.io adapter');
    } catch (error) {
      logger.error('Failed to connect Redis clients', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.pubClient.quit();
    await this.subClient.quit();
    logger.info('Redis clients disconnected');
  }
}