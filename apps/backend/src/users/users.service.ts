import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findOneByEmail(
    email: string,
  ): Promise<Prisma.UserGetPayload<{ include: { role: true } }> | null> {
    return this.prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });
  }
}
