import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum RideStatus {
  REQUESTED = 'requested',
  MATCHED = 'matched',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('rides')
export class RideEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'rider_id', type: 'uuid' })
  riderId: string;

  @Index()
  @Column({ name: 'driver_id', type: 'uuid', nullable: true })
  driverId: string | null;

  @Column({
    type: 'enum',
    enum: RideStatus,
    default: RideStatus.REQUESTED,
  })
  status: RideStatus;

  @Column({ name: 'pickup_lat', type: 'float' })
  pickupLat: number;

  @Column({ name: 'pickup_lng', type: 'float' })
  pickupLng: number;

  @Column({ name: 'destination_lat', type: 'float' })
  destinationLat: number;

  @Column({ name: 'destination_lng', type: 'float' })
  destinationLng: number;

  @Column({ type: 'float', nullable: true })
  fare: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}