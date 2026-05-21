import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import type { User } from '@prisma/client';

export type UserWithoutPassword = Omit<User, 'password'>;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Helper to hash refresh tokens for database storage.
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Validates user credentials.
   */
  async validateUser(
    email: string,
    pass: string,
  ): Promise<UserWithoutPassword> {
    const user = await this.usersService.findOneByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(pass, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = user;
    return result;
  }

  /**
   * Signs Access and Refresh tokens for a given user.
   */
  generateTokens(user: Pick<User, 'id' | 'email' | 'roleId'>) {
    const payload = {
      sub: user.id,
      email: user.email,
      roleId: user.roleId,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: (this.configService.get<string>('JWT_ACCESS_EXPIRY') ||
        '15m') as `${number}m`,
    });

    const refreshToken = this.jwtService.sign(
      { sub: user.id },
      {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: (this.configService.get<string>('JWT_REFRESH_EXPIRY') ||
          '7d') as `${number}d`,
      },
    );

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * Performs login flow: generates tokens and stores refresh token hash.
   */
  async login(user: UserWithoutPassword) {
    const { accessToken, refreshToken } = this.generateTokens(user);

    // Compute expiry date for refresh token
    const expiryString =
      this.configService.get<string>('JWT_REFRESH_EXPIRY') || '7d';
    const days = parseInt(expiryString) || 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    // Hash refresh token and save to database
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      user,
    };
  }

  /**
   * Performs refresh token rotation: validates old token, generates new set, updates DB hash.
   */
  async refresh(token: string) {
    try {
      this.jwtService.verify(token, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const tokenHash = this.hashToken(token);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { role: true } } },
    });

    if (
      !storedToken ||
      storedToken.revokedAt ||
      storedToken.expiresAt < new Date()
    ) {
      // Invalidate all tokens for user if reuse or revoked token is detected
      if (storedToken) {
        await this.prisma.refreshToken.deleteMany({
          where: { userId: storedToken.userId },
        });
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Delete the old refresh token (single-use token rotation)
    await this.prisma.refreshToken.delete({
      where: { id: storedToken.id },
    });

    const user = storedToken.user;
    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } =
      this.generateTokens(user);

    // Save the new refresh token
    const expiryString =
      this.configService.get<string>('JWT_REFRESH_EXPIRY') || '7d';
    const days = parseInt(expiryString) || 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    const newTokenHash = this.hashToken(newRefreshToken);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: newTokenHash,
        expiresAt,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userResult } = user;

    return {
      accessToken,
      refreshToken: newRefreshToken,
      user: userResult,
    };
  }

  /**
   * Revokes the refresh token.
   */
  async logout(token: string) {
    const tokenHash = this.hashToken(token);
    try {
      await this.prisma.refreshToken.delete({
        where: { tokenHash },
      });
    } catch {
      // Ignore if token is not found or already deleted
    }
  }
}
