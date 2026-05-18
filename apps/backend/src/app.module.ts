import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CategoriesModule } from './categories/categories.module';
import { InventoryModule } from './inventory/inventory.module';
import { EquipmentModule } from './equipment/equipment.module';

@Module({
  imports: [
    // Global configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),

    // Rate limiting: 10 requests per 15 minutes for auth endpoints
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 900000,
          limit: 60,
        },
      ],
    }),

    // Core modules
    PrismaModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    InventoryModule,
    EquipmentModule,
  ],
})
export class AppModule {}
