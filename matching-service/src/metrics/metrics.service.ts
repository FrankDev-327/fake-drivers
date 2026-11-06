import { Injectable } from '@nestjs/common';
import { Registry, Counter, Histogram, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry: Registry;

  readonly httpRequestsTotal: Counter;
  readonly httpRequestDuration: Histogram;
  readonly matchingDuration: Histogram;
  readonly matchingAttemptsTotal: Counter;
  readonly matchingSuccessTotal: Counter;
  readonly matchingFailedTotal: Counter;
  readonly kafkaMessagesProducedTotal: Counter;
  readonly kafkaMessagesConsumedTotal: Counter;
  readonly kafkaMessagesFailedTotal: Counter;

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

    // name matches the RideMatchingTooSlow alert in prometheus/alerts.yml
    this.matchingDuration = new Histogram({
      name: 'ride_matching_duration_seconds',
      help: 'Time to find and claim a driver for a ride request',
      buckets: [0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10],
      registers: [this.registry],
    });

    this.matchingAttemptsTotal = new Counter({
      name: 'matching_attempts_total',
      help: 'Ride requests the matching service tried to match',
      registers: [this.registry],
    });

    this.matchingSuccessTotal = new Counter({
      name: 'matching_success_total',
      help: 'Ride requests matched with a driver',
      registers: [this.registry],
    });

    this.matchingFailedTotal = new Counter({
      name: 'matching_failed_total',
      help: 'Ride requests with no available driver in range',
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

    this.kafkaMessagesFailedTotal = new Counter({
      name: 'kafka_messages_failed_total',
      help: 'Kafka messages that could not be parsed or handled',
      labelNames: ['topic'],
      registers: [this.registry],
    });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
