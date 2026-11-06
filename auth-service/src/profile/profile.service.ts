import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { UserEntity } from '../entities/user.entity';
import { S3Service } from '../s3/s3.service';
import { KafkaProducer } from '../kafka/kafka.producer';
import {
  ALLOWED_PHOTO_TYPES,
  CreatePhotoUploadUrlDto,
  MAX_PHOTO_BYTES,
} from './dto/create-photo-upload-url.dto';
import logger from '../../looger';

const UPLOAD_URL_EXPIRES_IN = 300;
const PHOTO_UPDATED_TOPIC = 'user.photo.updated';

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    private readonly s3Service: S3Service,
    private readonly kafkaProducer: KafkaProducer,
  ) {}

  async getProfile(userId: string) {
    const user = await this.findUser(userId);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      photo_url: user.photoUrl,
      // drivers can't go online without a photo, riders can skip it
      photo_required: user.role === 'driver',
    };
  }

  async createUploadUrl(userId: string, dto: CreatePhotoUploadUrlDto) {
    await this.findUser(userId);

    // the server picks the key, so a user can only ever write under their own prefix
    const key = `users/${userId}/${randomUUID()}.${EXTENSIONS[dto.content_type]}`;
    const uploadUrl = await this.s3Service.createUploadUrl(key, dto.content_type, UPLOAD_URL_EXPIRES_IN);

    return {
      upload_url: uploadUrl,
      key,
      expires_in: UPLOAD_URL_EXPIRES_IN,
      method: 'PUT',
      headers: { 'Content-Type': dto.content_type },
    };
  }

  async confirmPhoto(userId: string, key: string) {
    const user = await this.findUser(userId);

    if (!key.startsWith(`users/${userId}/`)) {
      throw new BadRequestException('This key does not belong to you');
    }

    const object = await this.s3Service.headObject(key);
    if (!object) {
      throw new BadRequestException('Photo not uploaded yet, PUT it to the upload_url first');
    }

    const isAllowedType = (ALLOWED_PHOTO_TYPES as readonly string[]).includes(object.ContentType);
    if (!isAllowedType || (object.ContentLength ?? 0) > MAX_PHOTO_BYTES) {
      await this.deleteFromS3(key);
      throw new BadRequestException('Photo must be jpeg, png or webp and 5 MB or smaller');
    }

    // confirming the same key again is allowed, so a client can retry if the event publish failed
    const previousKey = user.photoKey;
    if (previousKey !== key) {
      await this.usersRepository.update(userId, { photoKey: key });
      if (previousKey) {
        await this.deleteFromS3(previousKey);
      }
    }

    await this.publishPhotoUpdated(user, true);
    logger.info('Profile photo confirmed', { userId });

    return this.getProfile(userId);
  }

  async deletePhoto(userId: string) {
    const user = await this.findUser(userId);
    if (!user.photoKey) {
      throw new NotFoundException('You have no profile photo');
    }

    // DB first, then S3: a failure leaves an orphan object, never a user pointing at nothing
    await this.usersRepository.update(userId, { photoKey: null });
    await this.deleteFromS3(user.photoKey);
    await this.publishPhotoUpdated(user, false);
    logger.info('Profile photo deleted', { userId });

    return this.getProfile(userId);
  }

  private async findUser(userId: string): Promise<UserEntity> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  private async publishPhotoUpdated(user: UserEntity, hasPhoto: boolean) {
    await this.kafkaProducer.publish(PHOTO_UPDATED_TOPIC, user.id, {
      userId: user.id,
      role: user.role,
      hasPhoto,
      timestamp: new Date().toISOString(),
    });
  }

  private async deleteFromS3(key: string) {
    try {
      await this.s3Service.deleteObject(key);
    } catch (error) {
      logger.warn('Failed to delete photo from S3, object left orphaned', {
        key,
        error: (error as Error).message,
      });
    }
  }
}
