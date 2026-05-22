import type { TransformFnParams } from 'class-transformer';

export function parseBoolean({ value }: TransformFnParams): unknown {
  if (value === true || value === 'true') {
    return true;
  }

  if (value === false || value === 'false') {
    return false;
  }

  return value;
}
