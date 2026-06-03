import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../lib/env.js';
import { prisma } from '../lib/prisma.js';

interface JwtPayload {
  sub?: string | number;
  email?: string;
  roleId?: number;
  id?: number;
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res
        .status(401)
        .json({ message: 'Unauthorized: Missing or invalid token format' });
      return;
    }

    const token = authHeader.split(' ')[1];
    let decoded: JwtPayload;

    try {
      decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
    } catch {
      res
        .status(401)
        .json({ message: 'Unauthorized: Token invalid or expired' });
      return;
    }

    // sub holds userId. Let's find the user in database.
    const userId = decoded.sub || decoded.id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized: Invalid token payload' });
      return;
    }

    const user = await prisma.user.findFirst({
      where: {
        id: Number(userId),
        isActive: true,
        deletedAt: null,
      },
    });

    if (!user) {
      res
        .status(401)
        .json({ message: 'Unauthorized: User not found or inactive' });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      roleId: user.roleId,
    };

    next();
  } catch {
    res
      .status(500)
      .json({ message: 'Internal server error during authentication' });
  }
}
