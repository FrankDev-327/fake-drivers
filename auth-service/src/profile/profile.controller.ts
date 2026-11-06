import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { CurrentUserId } from '../common/current-user-id.decorator';
import { CreatePhotoUploadUrlDto } from './dto/create-photo-upload-url.dto';
import { ConfirmPhotoDto } from './dto/confirm-photo.dto';

@Controller('users/me')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  getProfile(@CurrentUserId() userId: string) {
    return this.profileService.getProfile(userId);
  }

  @Post('photo/upload-url')
  @HttpCode(HttpStatus.CREATED)
  createUploadUrl(@CurrentUserId() userId: string, @Body() dto: CreatePhotoUploadUrlDto) {
    return this.profileService.createUploadUrl(userId, dto);
  }

  @Post('photo/confirm')
  @HttpCode(HttpStatus.OK)
  confirmPhoto(@CurrentUserId() userId: string, @Body() dto: ConfirmPhotoDto) {
    return this.profileService.confirmPhoto(userId, dto.key);
  }

  @Delete('photo')
  @HttpCode(HttpStatus.OK)
  deletePhoto(@CurrentUserId() userId: string) {
    return this.profileService.deletePhoto(userId);
  }
}
