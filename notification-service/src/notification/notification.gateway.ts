import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { MetricsService } from '../metrics/metrics.service';
import { RedisService } from '../redis/redis.service';
import logger from '../../logger';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/',
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly metricsService: MetricsService,
    private readonly redisService: RedisService,
  ) {}

  afterInit() {
    // attach Redis adapter for horizontal scaling
    this.server.adapter(
      createAdapter(this.redisService.pubClient, this.redisService.subClient),
    );
    logger.info('Socket.io Redis adapter attached');
  }

  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;

    if (!userId) {
      client.disconnect();
      logger.warn('Socket connection rejected - no userId provided');
      return;
    }

    // join room named after userId so we can target this user specifically
    client.join(userId);
    this.metricsService.socketConnectionsTotal.inc();

    logger.info('Socket client connected', { userId, socketId: client.id });
  }

  handleDisconnect(client: Socket) {
    this.metricsService.socketConnectionsTotal.dec();
    logger.info('Socket client disconnected', { socketId: client.id });
  }

  // emit to a specific user by their userId
  emitToUser(userId: string, event: string, payload: any) {
    this.server.to(userId).emit(event, payload);
    this.metricsService.notificationsSentTotal.inc({ event_type: event });
    logger.info('Notification sent', { userId, event });
  }
}