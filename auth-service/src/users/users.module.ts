import { Module } from '@nestjs/common';
import { UserEntity } from '../entities/user.entity';
import { UsersService } from './users.service';
import { TypeOrmModule } from '@nestjs/typeorm/dist/typeorm.module';

@Module({
    imports: [TypeOrmModule.forFeature([UserEntity]),],
    controllers: [],
    providers: [UsersService],
    exports: [UsersService]
})
export class UsersModule { }
