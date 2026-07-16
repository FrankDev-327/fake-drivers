import { IsEmail, IsString, IsUUID } from 'class-validator';

export class CreateRiderDto {
  @IsUUID()
  userId: string;

  @IsString()
  name: string;

  @IsEmail()
  email: string;
}