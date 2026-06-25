import { Router, Request, Response } from 'express';
import { NotificationService } from '../services/notification.service.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { listNotificationsQuerySchema, type ListNotificationsQuery } from '../schemas/notification.schema.js';

const router = Router();

router.use(authenticate);

// ── GET /notifications ────────────────────────────────────────────────────────
// Returns notifications for the currently authenticated user.
// Optional ?unresolved=true to filter only unresolved ones.

router.get(
  '/',
  validate(listNotificationsQuerySchema, 'query'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const query = req.query as unknown as ListNotificationsQuery;
      const notifications = await NotificationService.findAll(
        req.user!.id,
        query.unresolved,
      );
      res.status(200).json(notifications);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ message });
    }
  },
);

// ── PATCH /notifications/:id/resolve ─────────────────────────────────────────
// Marks a single notification as resolved.

router.patch(
  '/:id/resolve',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ message: 'Invalid notification ID' });
        return;
      }

      const notification = await NotificationService.resolve(id);
      res.status(200).json(notification);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      if (message.includes('not found')) {
        res.status(404).json({ message });
        return;
      }
      res.status(500).json({ message });
    }
  },
);

export default router;