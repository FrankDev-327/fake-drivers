import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';

export enum UserRole {
  RIDER = 'rider',
  DRIVER = 'driver',
}

export class RegisterDto {
    @IsEmail()
    email: string;

    @IsString()
    @MinLength(8)
    password: string;

    @IsString()
    name: string;

    @IsEnum(UserRole)
    role: UserRole;
}