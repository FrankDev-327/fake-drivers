import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RiderEntity } from '../entities/rider.entity';
import logger from '../../logger';
import { CreateRiderDto } from './dto/create.rider.dto';

@Injectable()
export class RiderService {
  constructor(
    @InjectRepository(RiderEntity)
    private readonly riderRepository: Repository<RiderEntity>,
  ) {}

  async getRider(id: string): Promise<RiderEntity> {
    try {
      const rider = await this.riderRepository.findOne({ where: { id } });
      if (!rider) {
        throw new NotFoundException(`Rider ${id} not found`);
      }
      
      return rider;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      logger.error('Failed to find rider', {
        error: (error as Error).message,
        riderId: id,
      });
      throw new InternalServerErrorException('Failed to find rider');
    }
  }

  async createRider(data: CreateRiderDto): Promise<RiderEntity> {
    try {
      const rider = this.riderRepository.create(data);
      const saved = await this.riderRepository.save(rider);
      logger.info('Rider created', { riderId: saved.id });
      return saved;
    } catch (error) {
      logger.error('Failed to create rider', {
        error: (error as Error).message,
      });
      throw new InternalServerErrorException('Failed to create rider');
    }
  }
}
