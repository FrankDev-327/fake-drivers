import {
  Injectable,
  InternalServerErrorException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserEntity } from '../entities/user.entity';
import { RegisterDto } from '../auth/dto/register.dto';
import { MetricsService } from '../metrics/metrics.service';
import logger from '../../looger';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    private readonly jwtService: JwtService,
    private readonly metricsService: MetricsService,
  ) {}

  async register(dto: RegisterDto): Promise<{ token: string }> {
    try {
      const exists = await this.findByEmail(dto.email);

      if (exists) {
        this.metricsService.httpRequestsTotal.inc({
          method: 'POST',
          route: '/auth/register',
          status_code: '409',
        });
        throw new ConflictException('Email already in use');
      }

      const hashedPassword = await bcrypt.hash(dto.password, 10);
      const user = await this.usersRepository.save(
        this.usersRepository.create({
          email: dto.email,
          password: hashedPassword,
          name: dto.name,
          role: dto.role,
        }),
      );

      logger.info('User registered');
      this.metricsService.httpRequestsTotal.inc({
        method: 'POST',
        route: '/auth/register',
        status_code: '201',
      });

      const token = await this.jwtService.signAsync({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      return { token };

    } catch (error) {
      if (error instanceof ConflictException) throw error;
      logger.error('Failed to register user', {
        error: (error as Error).message,
        email: dto.email,
      });

      this.metricsService.httpRequestsTotal.inc({
        method: 'POST',
        route: '/auth/register',
        status_code: '500',
      });

      throw new InternalServerErrorException('Failed to register user');
    }
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    try {
      return this.usersRepository.findOne({ where: { email } });
    } catch (error) {
      logger.error('Failed to find user by email', {
        error: (error as Error).message,
        email,
      });
      throw new InternalServerErrorException('Failed to find user by email');
    }
  }
}