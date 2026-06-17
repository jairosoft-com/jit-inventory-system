import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// NodeNext ES Module path compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const possiblePaths = [
  path.join(process.cwd(), '.env'),
  path.join(process.cwd(), '../../.env'),
  path.join(__dirname, '../../../.env'),
  path.join(__dirname, '../../.env'),
];

for (const envPath of possiblePaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

export const env = {
  DATABASE_URL: process.env.DATABASE_URL || '',
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'access-secret',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'refresh-secret',
  JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY || '15m',
  JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY || '7d',
  BACKEND_PORT: parseInt(process.env.BACKEND_PORT || '3001', 10),
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
  NODE_ENV: process.env.NODE_ENV || 'development',
  RATE_LIMIT_GLOBAL: parseInt(process.env.RATE_LIMIT_GLOBAL || '600', 10),
  RATE_LIMIT_MUTATIVE: parseInt(process.env.RATE_LIMIT_MUTATIVE || '120', 10),
  RATE_LIMIT_AUTH: parseInt(process.env.RATE_LIMIT_AUTH || '15', 10),
  RATE_LIMIT_HEAVY: parseInt(process.env.RATE_LIMIT_HEAVY || '200', 10),
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
};
