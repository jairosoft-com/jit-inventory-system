import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CategoriesModule } from './categories/categories.module';
import { InventoryModule } from './inventory/inventory.module';
// import { EquipmentModule } from './equipment/equipment.module';  // ← COMMENT THIS OUT

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 900000,
          limit: 60,
        },
      ],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    InventoryModule,
    // EquipmentModule,  // ← COMMENT THIS OUT
  ],
  controllers: [AppController],
})
export class AppModule {}
