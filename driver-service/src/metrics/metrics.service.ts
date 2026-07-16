import { Injectable } from '@nestjs/common';
import {
  Registry,
  Counter,
  Histogram,
  collectDefaultMetrics,
} from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry: Registry;

  // HTTP metrics
  readonly httpRequestsTotal: Counter;
  readonly httpRequestDuration: Histogram;

  // Business metrics
  readonly driverLocationUpdatesTotal: Counter;
  readonly driverStatusUpdatesTotal: Counter;
  readonly driverLocationUpdateDuration: Histogram;

  // Kafka metrics
  readonly kafkaMessagesProducedTotal: Counter;

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

    this.driverLocationUpdatesTotal = new Counter({
      name: 'driver_location_updates_total',
      help: 'Total number of driver location updates received',
      labelNames: ['driver_id'],
      registers: [this.registry],
    });

    this.driverStatusUpdatesTotal = new Counter({
      name: 'driver_status_updates_total',
      help: 'Total number of driver status updates',
      labelNames: ['status'],
      registers: [this.registry],
    });

    this.driverLocationUpdateDuration = new Histogram({
      name: 'driver_location_update_duration_seconds',
      help: 'Duration of driver location update including Redis GEO and Kafka publish',
      labelNames: ['driver_id'],
      buckets: [0.005, 0.01, 0.05, 0.1, 0.3, 0.5, 1],
      registers: [this.registry],
    });

    this.kafkaMessagesProducedTotal = new Counter({
      name: 'kafka_messages_produced_total',
      help: 'Total number of Kafka messages produced',
      labelNames: ['topic'],
      registers: [this.registry],
    });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}