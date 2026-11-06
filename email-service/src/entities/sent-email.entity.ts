import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum EmailType {
  RIDE_RECEIPT = 'ride_receipt',
}

export enum EmailStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
}

// one row per email: the delivery log, and (for receipts) the rider's ride history
@Entity('sent_emails')
@Index('uq_sent_emails_ride_type', ['rideId', 'type'], { unique: true })
export class SentEmailEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'ride_id', type: 'uuid' })
  rideId: string;

  @Index('idx_sent_emails_user_id')
  @Column({ name: 'user_id', type: 'varchar', length: 255 })
  userId: string;

  @Column({ type: 'enum', enum: EmailType })
  type: EmailType;

  @Column({ type: 'enum', enum: EmailStatus, default: EmailStatus.PENDING })
  status: EmailStatus;

  @Column({ name: 'to_email', type: 'varchar', length: 255, nullable: true })
  toEmail: string | null;

  @Column({ type: 'varchar', length: 255 })
  subject: string;

  @Column({ name: 'ses_message_id', type: 'varchar', length: 255, nullable: true })
  sesMessageId: string | null;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  // ride snapshot, so the history doesn't depend on ride-service being up
  @Column({ type: 'float', nullable: true })
  fare: number | null;

  @Column({ name: 'pickup_lat', type: 'float', nullable: true })
  pickupLat: number | null;

  @Column({ name: 'pickup_lng', type: 'float', nullable: true })
  pickupLng: number | null;

  @Column({ name: 'destination_lat', type: 'float', nullable: true })
  destinationLat: number | null;

  @Column({ name: 'destination_lng', type: 'float', nullable: true })
  destinationLng: number | null;

  @Column({ name: 'ride_requested_at', type: 'timestamp', nullable: true })
  rideRequestedAt: Date | null;

  @Column({ name: 'ride_completed_at', type: 'timestamp', nullable: true })
  rideCompletedAt: Date | null;

  @Column({ name: 'sent_at', type: 'timestamp', nullable: true })
  sentAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
