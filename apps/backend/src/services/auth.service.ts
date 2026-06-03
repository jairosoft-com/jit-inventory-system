import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { env } from '../lib/env.js';
import type { User } from '@prisma/client';

export type UserWithoutPassword = Omit<User, 'password'> & {
  role?: any;
  permissions?: any;
};

export class AuthService {
  private static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private static getExpiryDate(expiryString: string): Date {
    const match = expiryString.match(/^(\d+)([smhd])$/);
    const value = match ? parseInt(match[1], 10) : 7;
    const unit = match ? match[2] : 'd';

    let multiplier = 24 * 60 * 60 * 1000; // default to days
    if (unit === 's') multiplier = 1000;
    else if (unit === 'm') multiplier = 60 * 1000;
    else if (unit === 'h') multiplier = 60 * 60 * 1000;

    return new Date(Date.now() + value * multiplier);
  }

  static async validateUser(
    email: string,
    pass: string,
  ): Promise<UserWithoutPassword> {
    const user = await prisma.user.findFirst({
      where: {
        email: email.trim().toLowerCase(),
        deletedAt: null,
      },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            description: true,
            rolePermissions: {
              select: {
                permission: {
                  select: {
                    id: true,
                    name: true,
                    resource: true,
                    action: true,
                    description: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new Error('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(pass, user.password);
    if (!isMatch) {
      throw new Error('Invalid email or password');
    }

    if (!user.isActive) {
      throw new Error('Account is inactive');
    }

    const result = { ...user } as Omit<typeof user, 'password'> & {
      password?: string;
    };
    delete result.password;
    return {
      ...result,
      permissions:
        user.role?.rolePermissions.map((rp) => ({
          id: rp.permission.id,
          name: rp.permission.name,
          resource: rp.permission.resource,
          action: rp.permission.action,
          description: rp.permission.description,
        })) || [],
    };
  }

  static generateTokens(user: Pick<User, 'id' | 'email' | 'roleId'>) {
    const payload = {
      sub: user.id,
      email: user.email,
      roleId: user.roleId,
    };

    const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRY as jwt.SignOptions['expiresIn'],
    });

    const refreshToken = jwt.sign({ sub: user.id }, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRY as jwt.SignOptions['expiresIn'],
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  static async login(user: UserWithoutPassword) {
    const { accessToken, refreshToken } = this.generateTokens(user);

    const expiresAt = this.getExpiryDate(env.JWT_REFRESH_EXPIRY);
    const tokenHash = this.hashToken(refreshToken);

    await prisma.refreshToken.create({
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

  static async refresh(token: string) {
    try {
      jwt.verify(token, env.JWT_REFRESH_SECRET);
    } catch {
      throw new Error('Invalid or expired refresh token');
    }

    const tokenHash = this.hashToken(token);
    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (
      !storedToken ||
      storedToken.revokedAt ||
      storedToken.expiresAt < new Date()
    ) {
      if (storedToken) {
        await prisma.refreshToken.deleteMany({
          where: { userId: storedToken.userId },
        });
      }
      throw new Error('Invalid or expired refresh token');
    }

    // Delete the old refresh token (single-use token rotation)
    await prisma.refreshToken.delete({
      where: { id: storedToken.id },
    });

    const user = storedToken.user;
    if (!user.isActive) {
      throw new Error('Account is inactive');
    }

    const { accessToken, refreshToken: newRefreshToken } =
      this.generateTokens(user);
    const expiresAt = this.getExpiryDate(env.JWT_REFRESH_EXPIRY);
    const newTokenHash = this.hashToken(newRefreshToken);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: newTokenHash,
        expiresAt,
      },
    });

    const userResult = { ...user } as Omit<typeof user, 'password'> & {
      password?: string;
    };
    delete userResult.password;
    const permissions =
      user.role?.rolePermissions.map((rp) => ({
        id: rp.permission.id,
        name: rp.permission.name,
        resource: rp.permission.resource,
        action: rp.permission.action,
        description: rp.permission.description,
      })) || [];

    return {
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        ...userResult,
        permissions,
      },
    };
  }

  static async logout(token: string) {
    const tokenHash = this.hashToken(token);
    try {
      await prisma.refreshToken.delete({
        where: { tokenHash },
      });
    } catch {
      // Ignore if token is not found or already deleted
    }
  }
}
