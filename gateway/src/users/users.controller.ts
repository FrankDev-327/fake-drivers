import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from './users.service';

@Controller('users/me')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  getProfile(@Req() req: Request) {
    return this.usersService.getProfile(req.user.id);
  }

  @Post('photo/upload-url')
  @HttpCode(HttpStatus.CREATED)
  createPhotoUploadUrl(@Req() req: Request, @Body() body: any) {
    return this.usersService.createPhotoUploadUrl(req.user.id, body);
  }

  @Post('photo/confirm')
  @HttpCode(HttpStatus.OK)
  confirmPhoto(@Req() req: Request, @Body() body: any) {
    return this.usersService.confirmPhoto(req.user.id, body);
  }

  @Delete('photo')
  @HttpCode(HttpStatus.OK)
  deletePhoto(@Req() req: Request) {
    return this.usersService.deletePhoto(req.user.id);
  }
}
