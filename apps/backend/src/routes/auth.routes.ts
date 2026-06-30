import { Router, Request, Response } from 'express';
import { AuthService } from '../services/auth.service.js';
import { loginSchema } from '../schemas/auth.schema.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import { env } from '../lib/env.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

const getRefreshTokenMaxAge = (): number => {
  const expiry = env.JWT_REFRESH_EXPIRY || '7d';
  const match = expiry.match(/^(\d+)([smhd])$/);
  const value = match ? parseInt(match[1], 10) : 7;
  const unit = match ? match[2] : 'd';

  let multiplier = 24 * 60 * 60 * 1000; // default to days
  if (unit === 's') multiplier = 1000;
  else if (unit === 'm') multiplier = 60 * 1000;
  else if (unit === 'h') multiplier = 60 * 60 * 1000;

  return value * multiplier;
};

// POST /auth/login
router.post(
  '/login',
  validate(loginSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body as {
        email: string;
        password: string;
      };
      const validatedUser = await AuthService.validateUser(email, password);
      const { accessToken, refreshToken, user } =
        await AuthService.login(validatedUser);

      res.cookie('jit_refresh_token', refreshToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/api/auth',
        maxAge: getRefreshTokenMaxAge(),
      });

      res.status(200).json({
        success: true,
        accessToken,
        user,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Invalid email or password';
      res.status(401).json({
        success: false,
        message,
      });
    }
  },
);

// POST /auth/refresh
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshToken = req.cookies?.jit_refresh_token as string | undefined;
    if (!refreshToken) {
      res
        .status(401)
        .json({ success: false, message: 'No refresh token provided' });
      return;
    }

    const {
      accessToken,
      refreshToken: newRefreshToken,
      user,
    } = await AuthService.refresh(refreshToken);

    res.cookie('jit_refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: getRefreshTokenMaxAge(),
    });

    res.status(200).json({
      success: true,
      accessToken,
      user,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Invalid or expired refresh token';
    res.status(401).json({
      success: false,
      message,
    });
  }
});

// POST /auth/logout
router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshToken = req.cookies?.jit_refresh_token as string | undefined;
    if (refreshToken) {
      await AuthService.logout(refreshToken);
    }

    res.clearCookie('jit_refresh_token', {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth',
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch {
    res.status(500).json({ success: false, message: 'Logout failed' });
  }
});

// GET /auth/me
router.get(
  '/me',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user?.email) {
        res
          .status(401)
          .json({ success: false, message: 'No user email in token' });
        return;
      }

      const user = await prisma.user.findFirst({
        where: {
          email: req.user.email,
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
        res.status(401).json({ success: false, message: 'User not found' });
        return;
      }

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

      res.status(200).json({
        success: true,
        user: {
          ...userResult,
          permissions,
          fullName: `${user.firstName} ${user.lastName}`,
          status: user.isActive ? 'Active' : 'Inactive',
        },
      });
    } catch {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve current user info',
      });
    }
  },
);

export default router;
