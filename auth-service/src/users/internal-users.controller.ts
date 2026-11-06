import { Controller, Get, NotFoundException, Param, ParseUUIDPipe } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../entities/user.entity';

// service-to-service lookup (email-service needs the rider's address).
// not routed by the gateway and auth-service publishes no port, so only the compose network reaches it
@Controller('internal/users')
export class InternalUsersController {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
  ) {}

  @Get(':id')
  async getUser(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }
}
