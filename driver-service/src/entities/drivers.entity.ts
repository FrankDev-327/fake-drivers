import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum DriverStatus {
  AVAILABLE = 'available',
  BUSY = 'busy',
  OFFLINE = 'offline',
}

@Entity('drivers')
export class DriverEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'user_id', unique: true })
  userId: string;

  @Column()
  name: string;

  @Index({ unique: true })
  @Column({ unique: true })
  email: string;

  @Column({
    type: 'enum',
    enum: DriverStatus,
    default: DriverStatus.OFFLINE,
  })
  status: DriverStatus;

  // synced from auth-service via user.photo.updated, a driver can't go online without a photo
  @Column({ name: 'has_photo', type: 'boolean', default: false })
  hasPhoto: boolean;

  @Column({ type: 'float', nullable: true })
  lat: number | null;

  @Column({ type: 'float', nullable: true })
  lng: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}