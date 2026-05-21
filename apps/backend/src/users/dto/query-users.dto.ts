import { Transform, Type } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

function parseBoolean({ value }: TransformFnParams): unknown {
  const fieldValue: unknown = value;

  if (fieldValue === true || fieldValue === 'true') {
    return true;
  }

  if (fieldValue === false || fieldValue === 'false') {
    return false;
  }

  return fieldValue;
}

function trimString({ value }: TransformFnParams): unknown {
  const fieldValue: unknown = value;

  if (typeof fieldValue === 'string') {
    return fieldValue.trim();
  }

  return fieldValue;
}

export class QueryUsersDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  roleId?: number;

  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
