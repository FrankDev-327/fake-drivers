import { IsString, MaxLength } from 'class-validator';

export class ConfirmPhotoDto {
  @IsString()
  @MaxLength(512)
  key: string;
}
