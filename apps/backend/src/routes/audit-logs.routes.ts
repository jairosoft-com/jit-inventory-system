import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { AuditLogService } from '../services/audit-log.service.js';
import {
  auditLogQuerySchema,
  type AuditLogQueryInput,
} from '../schemas/audit-logs.schema.js';

const router = Router();

// All audit-log routes require authentication
router.use(authenticate);

// ── GET /audit-logs ───────────────────────────────────────────────────────────
router.get(
  '/',
  authorize('audit_logs:read'),
  validate(auditLogQuerySchema, 'query'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const query = req.query as unknown as AuditLogQueryInput;
      const result = await AuditLogService.findAll({
        entityType: query.entityType,
        entityId: query.entityId,
        action: query.action,
        performedBy: query.performedBy,
        startDate: query.startDate,
        endDate: query.endDate,
        page: query.page ?? 1,
        limit: query.limit ?? 25,
      });
      res.status(200).json(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ message });
    }
  },
);

// ── GET /audit-logs/:id ───────────────────────────────────────────────────────
router.get(
  '/:id',
  authorize('audit_logs:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ message: 'Invalid audit log ID' });
        return;
      }
      const log = await AuditLogService.findOne(id);
      res.status(200).json(log);
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
