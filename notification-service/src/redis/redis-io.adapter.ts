import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { Server, ServerOptions } from 'socket.io';
import logger from '../../logger';

// the documented Nest way to plug the Redis adapter in: it's attached when the io server
// is created, so it never runs before the Redis clients exist
export class RedisIoAdapter extends IoAdapter {
  private readonly adapterConstructor: ReturnType<typeof createAdapter>;

  constructor(app: INestApplicationContext, redisUrl: string) {
    super(app);
    const pubClient = new Redis(redisUrl);
    const subClient = pubClient.duplicate();
    this.adapterConstructor = createAdapter(pubClient, subClient);
    logger.info('Socket.io Redis adapter configured');
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server: Server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}
