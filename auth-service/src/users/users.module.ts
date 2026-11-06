import { Module } from '@nestjs/common';
import { UserEntity } from '../entities/user.entity';
import { UsersService } from './users.service';
import { InternalUsersController } from './internal-users.controller';
import { MetricsModule } from '../metrics/metrics.module';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
    imports: [TypeOrmModule.forFeature([UserEntity]), MetricsModule],
    controllers: [InternalUsersController],
    providers: [UsersService],
    exports: [UsersService]
})
export class UsersModule { }
