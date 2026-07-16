import { Injectable } from '@nestjs/common';
import { Registry, Counter, Histogram, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry: Registry;

  readonly httpRequestsTotal: Counter;
  readonly httpRequestDuration: Histogram;
  readonly rideRequestsTotal: Counter;
  readonly rideStatusUpdatesTotal: Counter;
  readonly kafkaMessagesProducedTotal: Counter;
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

    this.rideRequestsTotal = new Counter({
      name: 'ride_requests_total',
      help: 'Total number of ride requests',
      registers: [this.registry],
    });

    this.rideStatusUpdatesTotal = new Counter({
      name: 'ride_status_updates_total',
      help: 'Total number of ride status updates',
      labelNames: ['status'],
      registers: [this.registry],
    });

    this.kafkaMessagesProducedTotal = new Counter({
      name: 'kafka_messages_produced_total',
      help: 'Total number of Kafka messages produced',
      labelNames: ['topic'],
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