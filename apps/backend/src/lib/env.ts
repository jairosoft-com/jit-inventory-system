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
  // Whether to mark the refresh-token cookie as Secure (HTTPS-only).
  // Deliberately NOT tied to NODE_ENV: a "production" deployment served over
  // plain HTTP (e.g. an internal LAN box reached by IP) would have the
  // browser silently refuse to store/send a Secure cookie, which breaks
  // session persistence for every user on every page refresh. Only set this
  // to 'true' once the app is actually served over HTTPS.
  COOKIE_SECURE: process.env.COOKIE_SECURE === 'true',
  // Set to 'true' (or a hop count, per Express docs) when running behind a
  // reverse proxy / load balancer so req.ip reflects the real client IP
  // instead of the proxy's IP. Leaving this off behind a proxy causes every
  // client to collapse into a single IP-based rate-limit bucket.
  TRUST_PROXY: process.env.TRUST_PROXY || '',
  RATE_LIMIT_GLOBAL: parseInt(process.env.RATE_LIMIT_GLOBAL || '600', 10),
  RATE_LIMIT_MUTATIVE: parseInt(process.env.RATE_LIMIT_MUTATIVE || '120', 10),
  RATE_LIMIT_AUTH: parseInt(process.env.RATE_LIMIT_AUTH || '300', 10),
  RATE_LIMIT_AUTH_LOGIN: parseInt(process.env.RATE_LIMIT_AUTH_LOGIN || '20', 10),
  RATE_LIMIT_HEAVY: parseInt(process.env.RATE_LIMIT_HEAVY || '200', 10),
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  SMTP_HOST: process.env.SMTP_HOST || 'localhost',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '1025', 10),
  SMTP_FROM:
    process.env.SMTP_FROM || 'JIT Inventory System <noreply@jitims.com>',
};
