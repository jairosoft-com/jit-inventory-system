import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

// All maintenance alert routes require authentication and manager/admin roles (reports:export)
router.use(authenticate);
router.use(authorize('reports:export'));

const alertIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// GET /api/maintenance-alerts - Get all unread maintenance alerts
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const alerts = await prisma.maintenanceAlert.findMany({
      where: { isRead: false },
      include: {
        maintenanceLog: {
          include: {
            equipment: {
              include: {
                item: { select: { itemName: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({ alerts, count: alerts.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ message });
  }
});

// GET /api/maintenance-alerts/count - Get unread count
router.get('/count', async (_req: Request, res: Response): Promise<void> => {
  try {
    const count = await prisma.maintenanceAlert.count({
      where: { isRead: false },
    });
    res.status(200).json({ count });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ message });
  }
});

// PATCH /api/maintenance-alerts/read-all - Mark all as read
router.patch('/read-all', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await prisma.maintenanceAlert.updateMany({
      where: { isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    res.status(200).json({ updated: result.count });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ message });
  }
});

// PATCH /api/maintenance-alerts/:id/read - Mark a single alert as read
router.patch(
  '/:id/read',
  validate(alertIdSchema, 'params'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as unknown as z.infer<typeof alertIdSchema>;
      const alert = await prisma.maintenanceAlert.update({
        where: { id },
        data: { isRead: true, readAt: new Date() },
      });
      res.status(200).json({ alert });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ message });
    }
  }
);

export default router;
