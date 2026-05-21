import { Transform, Type } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

function parseBoolean({ value }: TransformFnParams): unknown {
  if (value === true || value === 'true') {
    return true;
  }

  if (value === false || value === 'false') {
    return false;
  }

  return value;
}

export class UpdateUserAccessDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  roleId?: number;

  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  isActive?: boolean;
}