import { Request, Response, NextFunction, RequestHandler } from 'express';
import { prisma } from '../lib/prisma.js';

export function authorize(...requiredPermissions: string[]): RequestHandler {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (requiredPermissions.length === 0) {
        next();
        return;
      }

      const user = req.user;
      if (!user || !user.roleId) {
        res
          .status(403)
          .json({ message: 'Forbidden: Insufficient permissions' });
        return;
      }

      // Resolve permissions from DB on every request to prevent privilege escalation
      const rolePermissions = await prisma.rolePermission.findMany({
        where: { roleId: user.roleId },
        include: { permission: true },
      });

      const userPermissions = rolePermissions.map((rp) => rp.permission.name);
      const hasAllPermissions = requiredPermissions.every((perm) =>
        userPermissions.includes(perm),
      );

      if (!hasAllPermissions) {
        res
          .status(403)
          .json({ message: 'Forbidden: Insufficient permissions' });
        return;
      }

      next();
    } catch {
      res
        .status(500)
        .json({ message: 'Internal server error during authorization' });
    }
  };
}
