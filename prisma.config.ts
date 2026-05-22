import { defineConfig } from '@prisma/config';
import * as dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  migrations: {
    seed: 'npx tsx prisma/seed.ts',
  },
});