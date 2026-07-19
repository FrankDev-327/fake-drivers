import { Injectable, OnModuleInit } from '@nestjs/common';
import { KafkaConsumer } from '../kafka/kafka.consumer';
import { NotificationGateway } from './notification.gateway';
import logger from '../../logger';

@Injectable()
export class NotificationService implements OnModuleInit {
  constructor(
    private readonly kafkaConsumer: KafkaConsumer,
    private readonly gateway: NotificationGateway,
  ) {}

  onModuleInit() {
    this.kafkaConsumer.registerHandler('driver.assigned', async (payload) => {
      // notify rider that a driver was found
      this.gateway.emitToUser(payload.riderId, 'driver_assigned', {
        rideId: payload.rideId,
        driverId: payload.driverId,
        message: 'A driver has been assigned to your ride',
      });

      // notify driver they have a new ride request
      this.gateway.emitToUser(payload.driverId, 'ride_request', {
        rideId: payload.rideId,
        riderId: payload.riderId,
        message: 'New ride request',
      });

      logger.info('Notifications sent for driver.assigned', {
        rideId: payload.rideId,
      });
    });

    this.kafkaConsumer.registerHandler('ride.status.updated', async (payload) => {
      // notify both rider and driver about status change
      this.gateway.emitToUser(payload.riderId, 'ride_status_updated', {
        rideId: payload.rideId,
        status: payload.status,
      });

      if (payload.driverId) {
        this.gateway.emitToUser(payload.driverId, 'ride_status_updated', {
          rideId: payload.rideId,
          status: payload.status,
        });
      }

      logger.info('Notifications sent for ride.status.updated', {
        rideId: payload.rideId,
        status: payload.status,
      });
    });

    this.kafkaConsumer.registerHandler('ride.completed', async (payload) => {
      this.gateway.emitToUser(payload.riderId, 'ride_completed', {
        rideId: payload.rideId,
        fare: payload.fare,
        message: 'Your ride has been completed',
      });

      if (payload.driverId) {
        this.gateway.emitToUser(payload.driverId, 'ride_completed', {
          rideId: payload.rideId,
          fare: payload.fare,
          message: 'Ride completed',
        });
      }

      logger.info('Notifications sent for ride.completed', {
        rideId: payload.rideId,
      });
    });

    this.kafkaConsumer.registerHandler('payment.completed', async (payload) => {
      this.gateway.emitToUser(payload.riderId, 'payment_completed', {
        rideId: payload.rideId,
        amount: payload.amount,
        message: 'Payment processed successfully',
      });

      logger.info('Notification sent for payment.completed', {
        rideId: payload.rideId,
      });
    });

    this.kafkaConsumer.registerHandler('payment.failed', async (payload) => {
      this.gateway.emitToUser(payload.riderId, 'payment_failed', {
        rideId: payload.rideId,
        message: 'Payment failed, please try again',
      });

      logger.info('Notification sent for payment.failed', {
        rideId: payload.rideId,
      });
    });
  }
}