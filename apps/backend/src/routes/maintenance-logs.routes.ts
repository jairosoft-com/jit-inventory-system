import { Router, Request, Response } from 'express';
import { MaintenanceLogsService } from '../services/maintenance-logs.service.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  scheduleMaintenanceSchema,
  updateMaintenanceScheduleSchema,
  listMaintenanceLogsQuerySchema,
  type ScheduleMaintenanceInput,
  type UpdateMaintenanceScheduleInput,
  type ListMaintenanceLogsQuery,
} from '../schemas/maintenance-logs.schema.js';

const router = Router();

router.use(authenticate);

// GET /maintenance-logs - List all maintenance logs
router.get(
  '/',
  authorize('maintenance:read'),
  validate(listMaintenanceLogsQuerySchema, 'query'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await MaintenanceLogsService.findAll(
        req.query as unknown as ListMaintenanceLogsQuery,
      );
      res.status(200).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ message });
    }
  },
);

// POST /maintenance-logs - Create a new maintenance log slot manually
router.post(
  '/',
  authorize('maintenance:create'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { equipmentId, description } = req.body;
      if (!equipmentId || !description) {
        res.status(400).json({ message: 'Equipment ID and description are required' });
        return;
      }
      const log = await MaintenanceLogsService.create(
        { equipmentId: Number(equipmentId), description: String(description) },
        req.user!.id,
      );
      res.status(201).json(log);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bad request';
      if (message.includes('not found')) {
        res.status(404).json({ message });
      } else if (message.includes('active/open')) {
        res.status(409).json({ message });
      } else {
        res.status(400).json({ message });
      }
    }
  },
);

// GET /maintenance-logs/:id - Get single log
router.get(
  '/:id',
  authorize('maintenance:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ message: 'Invalid maintenance log ID' });
        return;
      }
      const log = await MaintenanceLogsService.findOne(id);
      res.status(200).json(log);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      if (message.includes('not found')) {
        res.status(404).json({ message });
      } else {
        res.status(500).json({ message });
      }
    }
  },
);

// PUT /maintenance-logs/:id/schedule - Task 2 / Scenario 2
router.put(
  '/:id/schedule',
  authorize('maintenance:update'),
  validate(scheduleMaintenanceSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ message: 'Invalid maintenance log ID' });
        return;
      }
      const result = await MaintenanceLogsService.schedule(
        id,
        req.body as ScheduleMaintenanceInput,
        req.user!.id,
      );
      res.status(200).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bad request';
      if (message.includes('not found')) {
        res.status(404).json({ message });
      } else if (message.includes('active/open')) {
        res.status(409).json({ message });
      } else {
        res.status(400).json({ message });
      }
    }
  },
);

// PATCH /maintenance-logs/:id - Scenario 3 (update existing schedule / status / details)
router.patch(
  '/:id',
  authorize('maintenance:update'),
  validate(updateMaintenanceScheduleSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ message: 'Invalid maintenance log ID' });
        return;
      }
      const result = await MaintenanceLogsService.update(
        id,
        req.body as UpdateMaintenanceScheduleInput,
        req.user!.id,
      );
      res.status(200).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bad request';
      if (message.includes('not found')) {
        res.status(404).json({ message });
      } else if (message.includes('active/open')) {
        res.status(409).json({ message });
      } else {
        res.status(400).json({ message });
      }
    }
  },
);

export default router;
