import { Injectable } from '@nestjs/common';
import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry: Registry;

  readonly httpRequestsTotal: Counter;
  readonly httpRequestDuration: Histogram;
  readonly socketConnectionsTotal: Gauge;
  readonly notificationsSentTotal: Counter;
  readonly kafkaMessagesConsumedTotal: Counter;

  constructor() {
    this.registry = new Registry();

    collectDefaultMetrics({ register: this.registry });

    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    this.socketConnectionsTotal = new Gauge({
      name: 'socket_connections_total',
      help: 'Current number of active Socket.io connections',
      registers: [this.registry],
    });

    this.notificationsSentTotal = new Counter({
      name: 'notifications_sent_total',
      help: 'Total number of notifications sent via Socket.io',
      labelNames: ['event_type'],
      registers: [this.registry],
    });

    this.kafkaMessagesConsumedTotal = new Counter({
      name: 'kafka_messages_consumed_total',
      help: 'Total number of Kafka messages consumed',
      labelNames: ['topic'],
      registers: [this.registry],
    });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}