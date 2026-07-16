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
  @Column()
  riderId: string;

  @Index()
  @Column({ nullable: true })
  driverId: string | null;

  @Column({
    type: 'enum',
    enum: RideStatus,
    default: RideStatus.REQUESTED,
  })
  status: RideStatus;

  @Column({ type: 'float' })
  pickupLat: number;

  @Column({ type: 'float' })
  pickupLng: number;

  @Column({ type: 'float' })
  destinationLat: number;

  @Column({ type: 'float' })
  destinationLng: number;

  @Column({ type: 'float', nullable: true })
  fare: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}