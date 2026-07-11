import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import logger from '../../logger';

@Injectable()
export class AuthService {
  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<any> {
    try {
      const url = `${this.config.get('AUTH_SERVICE_URL')}/auth/register`;
      const response = await firstValueFrom(
        this.httpService.post(url, dto),
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to call auth-service register', {
        error: (error as Error).message,
      });
      throw new InternalServerErrorException('Auth service unavailable');
    }
  }

  async login(dto: LoginDto): Promise<any> {
    try {
      const url = `${this.config.get('AUTH_SERVICE_URL')}/auth/login`;
      const response = await firstValueFrom(
        this.httpService.post(url, dto),
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to call auth-service login', {
        error: (error as Error).message,
      });
      throw new InternalServerErrorException('Auth service unavailable');
    }
  }
}