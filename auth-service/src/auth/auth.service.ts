import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersRepository } from '../users/users.repository';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { logger } from '../common/logger/logger';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    try {
      const exists = await this.usersRepository.existsByEmail(dto.email);

      if (exists) {
        throw new ConflictException('Email already in use');
      }

      const hashedPassword = await bcrypt.hash(dto.password, 10);
      const user = await this.usersRepository.create({
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        role: dto.role,
      });

      logger.info('User registered', { userId: user.id, role: user.role });

      const token = this.jwtService.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      };
    } catch (error) {
      if (error instanceof ConflictException) throw error;

      logger.error('Failed to register user', {
        error: (error as Error).message,
        email: dto.email,
      });

      throw new InternalServerErrorException('Failed to register user');
    }
  }

  async login(dto: LoginDto) {
    try {
      const user = await this.usersRepository.findByEmail(dto.email);

      // same message for wrong email or wrong password
      // prevents attackers from knowing if email exists
      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const passwordValid = await bcrypt.compare(dto.password, user.password);

      if (!passwordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      logger.info('User logged in', { userId: user.id, role: user.role });

      const token = this.jwtService.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;

      logger.error('Failed to login user', {
        error: (error as Error).message,
        email: dto.email,
      });

      throw new InternalServerErrorException('Failed to login');
    }
  }

  async validateToken(token: string) {
    try {
      const payload = this.jwtService.verify(token);
      const user = await this.usersRepository.findById(payload.sub);

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return {
        id: user.id,
        email: user.email,
        role: user.role,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}