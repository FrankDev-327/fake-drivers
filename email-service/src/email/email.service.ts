import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { EmailStatus, EmailType, SentEmailEntity } from '../entities/sent-email.entity';
import { SesService } from '../ses/ses.service';
import { UsersClient } from '../users/users.client';
import { KafkaConsumer } from '../kafka/kafka.consumer';
import { MetricsService } from '../metrics/metrics.service';
import { RideReceipt, rideReceiptHtml, rideReceiptSubject, rideReceiptText } from './templates/ride-receipt';
import logger from '../../logger';

const RIDE_COMPLETED = 'ride.completed';
const USER_NOT_FOUND = 'user_not_found';
const UNIQUE_VIOLATION = '23505';

type RideCompletedEvent = {
  rideId: string;
  riderId: string;
  driverId: string | null;
  fare: number | null;
  pickupLat?: number;
  pickupLng?: number;
  destinationLat?: number;
  destinationLng?: number;
  requestedAt?: string;
  completedAt?: string;
  timestamp: string;
};

@Injectable()
export class EmailService implements OnModuleInit {
  constructor(
    @InjectRepository(SentEmailEntity)
    private readonly emailsRepository: Repository<SentEmailEntity>,
    private readonly sesService: SesService,
    private readonly usersClient: UsersClient,
    private readonly kafkaConsumer: KafkaConsumer,
    private readonly metricsService: MetricsService,
  ) {}

  onModuleInit() {
    this.kafkaConsumer.registerHandler(RIDE_COMPLETED, (payload) => this.sendRideReceipt(payload));
  }

  async sendRideReceipt(event: RideCompletedEvent): Promise<void> {
    const type = EmailType.RIDE_RECEIPT;
    if (!event?.rideId || !event?.riderId) {
      logger.warn('ride.completed without rideId or riderId, no receipt', { rideId: event?.rideId });
      return;
    }

    let row = await this.emailsRepository.findOne({ where: { rideId: event.rideId, type } });
    if (row?.status === EmailStatus.SENT) {
      // Kafka redelivered the event: the rider already has this receipt
      this.metricsService.emailsDuplicateSkippedTotal.inc({ type });
      return;
    }
    if (row?.status === EmailStatus.FAILED && row.lastError === USER_NOT_FOUND) return;

    // throws on a network error or auth 5xx, so the consumer rethrows and Kafka retries
    const user = await this.usersClient.getUser(event.riderId);
    const receipt = this.toReceipt(event, user?.name ?? 'there');
    const subject = rideReceiptSubject(receipt);

    if (!row) {
      row = await this.createRow(event, subject, user?.email ?? null);
    }

    if (!user) {
      // permanent: retrying won't make the user appear, so record it and move on
      await this.emailsRepository.update(row.id, { status: EmailStatus.FAILED, lastError: USER_NOT_FOUND });
      this.metricsService.emailsFailedTotal.inc({ type, reason: USER_NOT_FOUND });
      logger.warn('Ride receipt not sent, rider not found', { rideId: event.rideId, riderId: event.riderId });
      return;
    }

    const endTimer = this.metricsService.emailSendDuration.startTimer({ type });
    try {
      const messageId = await this.sesService.send({
        to: user.email,
        subject,
        html: rideReceiptHtml(receipt),
        text: rideReceiptText(receipt),
      });
      endTimer();

      await this.emailsRepository.update(row.id, {
        status: EmailStatus.SENT,
        toEmail: user.email,
        sesMessageId: messageId,
        sentAt: new Date(),
        attempts: row.attempts + 1,
        lastError: null,
      });

      this.metricsService.emailsSentTotal.inc({ type });
      this.metricsService.emailDeliveryDelay.observe(
        { type },
        Math.max(0, (Date.now() - receipt.completedAt.getTime()) / 1000),
      );
      logger.info('Ride receipt sent', { rideId: event.rideId, messageId });
    } catch (error) {
      endTimer();
      await this.emailsRepository.update(row.id, {
        status: EmailStatus.FAILED,
        attempts: row.attempts + 1,
        lastError: (error as Error).message.slice(0, 1000),
      });
      this.metricsService.emailsFailedTotal.inc({ type, reason: 'ses_error' });
      throw error;
    }
  }

  // the rider's past rides, from their receipts (newest first)
  async getMyReceipts(userId: string) {
    const rows = await this.emailsRepository.find({
      where: { userId, type: EmailType.RIDE_RECEIPT },
      order: { createdAt: 'DESC' },
      take: 50,
    });

    return rows.map((r) => ({
      ride_id: r.rideId,
      fare: r.fare,
      pickup: r.pickupLat != null ? { lat: r.pickupLat, lng: r.pickupLng } : null,
      destination: r.destinationLat != null ? { lat: r.destinationLat, lng: r.destinationLng } : null,
      requested_at: r.rideRequestedAt,
      completed_at: r.rideCompletedAt,
      receipt: {
        status: r.status,
        to: r.toEmail,
        subject: r.subject,
        sent_at: r.sentAt,
        attempts: r.attempts,
      },
    }));
  }

  private async createRow(event: RideCompletedEvent, subject: string, toEmail: string | null) {
    const receipt = this.toReceipt(event, '');
    try {
      return await this.emailsRepository.save(
        this.emailsRepository.create({
          rideId: event.rideId,
          userId: event.riderId,
          type: EmailType.RIDE_RECEIPT,
          status: EmailStatus.PENDING,
          toEmail,
          subject,
          fare: receipt.fare,
          pickupLat: receipt.pickup?.lat ?? null,
          pickupLng: receipt.pickup?.lng ?? null,
          destinationLat: receipt.destination?.lat ?? null,
          destinationLng: receipt.destination?.lng ?? null,
          rideRequestedAt: receipt.requestedAt,
          rideCompletedAt: receipt.completedAt,
        }),
      );
    } catch (error) {
      // the unique (ride_id, type) index: another delivery created it first, use that row
      if (error instanceof QueryFailedError && (error as any).driverError?.code === UNIQUE_VIOLATION) {
        return this.emailsRepository.findOne({ where: { rideId: event.rideId, type: EmailType.RIDE_RECEIPT } });
      }
      throw error;
    }
  }

  private toReceipt(event: RideCompletedEvent, riderName: string): RideReceipt {
    const has = (a?: number, b?: number) => a != null && b != null;
    return {
      riderName,
      rideId: event.rideId,
      fare: event.fare ?? null,
      pickup: has(event.pickupLat, event.pickupLng) ? { lat: event.pickupLat, lng: event.pickupLng } : null,
      destination: has(event.destinationLat, event.destinationLng)
        ? { lat: event.destinationLat, lng: event.destinationLng }
        : null,
      requestedAt: event.requestedAt ? new Date(event.requestedAt) : null,
      completedAt: new Date(event.completedAt ?? event.timestamp),
    };
  }
}
