import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

type JwtPayload = {
  sub?: number | string;
  id?: number | string;
  userId?: number | string;
  email?: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const userId = Number(payload.sub ?? payload.id ?? payload.userId);

    if (!userId) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        roleId: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User is inactive or does not exist');
    }

    return {
      id: user.id,
      email: user.email,
      roleId: user.roleId,
    };
  }
}
