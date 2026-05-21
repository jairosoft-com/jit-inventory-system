import { Transform, Type } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

function trimString({ value }: TransformFnParams): unknown {
  const fieldValue: unknown = value;

  if (typeof fieldValue === 'string') {
    return fieldValue.trim();
  }

  return fieldValue;
}

function normalizeEmail({ value }: TransformFnParams): unknown {
  const fieldValue: unknown = value;

  if (typeof fieldValue === 'string') {
    return fieldValue.trim().toLowerCase();
  }

  return fieldValue;
}

export class CreateUserDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @Transform(normalizeEmail)
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  roleId!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
