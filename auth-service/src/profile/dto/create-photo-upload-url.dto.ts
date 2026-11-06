import { IsIn, IsInt, Max, Min } from 'class-validator';

export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export class CreatePhotoUploadUrlDto {
  @IsIn(ALLOWED_PHOTO_TYPES, { message: 'content_type must be image/jpeg, image/png or image/webp' })
  content_type: string;

  @IsInt()
  @Min(1)
  @Max(MAX_PHOTO_BYTES, { message: 'photo must be 5 MB or smaller' })
  size_bytes: number;
}
