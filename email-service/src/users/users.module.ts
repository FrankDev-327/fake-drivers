import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { UsersClient } from './users.client';

@Module({
  imports: [HttpModule],
  providers: [UsersClient],
  exports: [UsersClient],
})
export class UsersModule {}
