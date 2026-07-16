import { IsEmail, IsNumber, IsString, IsUUID, IsOptional, Min, Max } from 'class-validator';

export class CreateDriverDto {
    @IsUUID()
    userId: string;

    @IsString()
    name: string;

    @IsEmail()
    email: string;

    @IsNumber()
    @IsOptional()
    @Min(-90)
    @Max(90)
    lat?: number;

    @IsNumber()
    @IsOptional()
    @Min(-180)
    @Max(180)
    lng?: number;
}