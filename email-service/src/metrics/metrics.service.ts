import { Injectable } from '@nestjs/common';
import { Registry, Counter, Histogram, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry: Registry;

  readonly httpRequestsTotal: Counter;
  readonly httpRequestDuration: Histogram;
  readonly emailsSentTotal: Counter;
  readonly emailsFailedTotal: Counter;
  readonly emailsDuplicateSkippedTotal: Counter;
  readonly emailSendDuration: Histogram;
  readonly emailDeliveryDelay: Histogram;
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

    this.emailsSentTotal = new Counter({
      name: 'emails_sent_total',
      help: 'Emails accepted by SES',
      labelNames: ['type'],
      registers: [this.registry],
    });

    this.emailsFailedTotal = new Counter({
      name: 'emails_failed_total',
      help: 'Emails that could not be sent (ses_error is retried, user_not_found is final)',
      labelNames: ['type', 'reason'],
      registers: [this.registry],
    });

    this.emailsDuplicateSkippedTotal = new Counter({
      name: 'emails_duplicate_skipped_total',
      help: 'Redelivered events skipped because that email was already sent',
      labelNames: ['type'],
      registers: [this.registry],
    });

    this.emailSendDuration = new Histogram({
      name: 'email_send_duration_seconds',
      help: 'Time of the SES SendEmail call',
      labelNames: ['type'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    this.emailDeliveryDelay = new Histogram({
      name: 'email_delivery_delay_seconds',
      help: 'From ride completed to receipt accepted by SES',
      labelNames: ['type'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 300],
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
