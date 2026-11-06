import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MetricsService } from '../metrics/metrics.service';
import logger from '../../logger';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/',
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly metricsService: MetricsService) {}

  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;

    if (!userId) {
      client.disconnect();
      logger.warn('Socket connection rejected - no userId provided');
      return;
    }

    // join room named after userId so we can target this user specifically
    client.data.userId = userId;
    client.join(userId);
    this.metricsService.socketConnectionsActive.inc();

    logger.info('Socket client connected', { userId, socketId: client.id });
  }

  handleDisconnect(client: Socket) {
    // rejected connections were never counted, so don't decrement for them
    if (!client.data.userId) return;

    this.metricsService.socketConnectionsActive.dec();
    logger.info('Socket client disconnected', { socketId: client.id });
  }

  // emit to a specific user by their userId
  emitToUser(userId: string | undefined, event: string, payload: any) {
    if (!userId) {
      this.metricsService.notificationsSkippedTotal.inc({ event_type: event });
      logger.warn('Notification skipped, event has no recipient', { event });
      return;
    }

    this.server.to(userId).emit(event, payload);
    this.metricsService.notificationsSentTotal.inc({ event_type: event });
    logger.info('Notification sent', { userId, event });
  }
}
