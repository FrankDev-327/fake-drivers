import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  AfterLoad,
  AfterInsert,
} from 'typeorm';

export enum UserRole {
  RIDER = 'rider',
  DRIVER = 'driver',
}

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  // store the S3 key, never the URL, so the bucket host can change
  @Column({ name: 'photo_key', type: 'varchar', length: 512, nullable: true })
  photoKey: string | null;

  photoUrl: string | null;

  @AfterLoad()
  @AfterInsert()
  buildPhotoUrl() {
    this.photoUrl = this.photoKey
      ? `${process.env.S3_PUBLIC_ENDPOINT}/${process.env.S3_BUCKET}/${this.photoKey}`
      : null;
  }

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}