import { Router, Request, Response } from 'express';
import { ConditionStatus } from '@prisma/client';
import { ProcurementService } from '../services/procurement.service.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  updatePurchaseOrderStatusSchema,
  listPurchaseOrdersQuerySchema,
  addAttachmentSchema,
  type CreatePurchaseOrderInput,
  type UpdatePurchaseOrderInput,
  type UpdatePurchaseOrderStatusInput,
  type ListPurchaseOrdersQuery,
  type AddAttachmentInput,
} from '../schemas/procurement.schema.js';

const router = Router();

// All procurement routes require authentication
router.use(authenticate);

// ── POST /procurement ────────────────────────────────────────────────────────
router.post(
  '/',
  authorize('purchase_orders:create'),
  validate(createPurchaseOrderSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const po = await ProcurementService.create(
        req.body as CreatePurchaseOrderInput,
        req.user!.id,
      );
      res.status(201).json(po);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bad request';
      if (message.includes('not found') || message.includes('inactive')) {
        res.status(404).json({ message });
        return;
      }
      if (message.includes('Duplicate')) {
        res.status(409).json({ message });
        return;
      }
      res.status(400).json({ message });
    }
  },
);

// ── GET /procurement ─────────────────────────────────────────────────────────
router.get(
  '/',
  authorize('purchase_orders:read'),
  validate(listPurchaseOrdersQuerySchema, 'query'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const query = req.query as unknown as ListPurchaseOrdersQuery;
      const purchaseOrders = await ProcurementService.findAll(
        query.status,
        query.includeArchived,
      );
      res.status(200).json(purchaseOrders);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ message });
    }
  },
);

// ── GET /procurement/:id ─────────────────────────────────────────────────────
router.get(
  '/:id',
  authorize('purchase_orders:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ message: 'Invalid purchase order ID' });
        return;
      }
      const po = await ProcurementService.findOne(id);
      res.status(200).json(po);
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

// ── PUT /procurement/:id (update draft) ──────────────────────────────────────
router.put(
  '/:id',
  authorize('purchase_orders:update'),
  validate(updatePurchaseOrderSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ message: 'Invalid purchase order ID' });
        return;
      }
      const po = await ProcurementService.update(
        id,
        req.body as UpdatePurchaseOrderInput,
        req.user!.id,
      );
      res.status(200).json(po);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bad request';
      if (message.includes('not found') || message.includes('inactive')) {
        res.status(404).json({ message });
        return;
      }
      if (message.includes('DRAFT')) {
        res.status(409).json({ message });
        return;
      }
      if (message.includes('Duplicate')) {
        res.status(409).json({ message });
        return;
      }
      res.status(400).json({ message });
    }
  },
);

// ── PATCH /procurement/:id/status ────────────────────────────────────────────
router.patch(
  '/:id/status',
  authorize('purchase_orders:update'),
  validate(updatePurchaseOrderStatusSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ message: 'Invalid purchase order ID' });
        return;
      }
      const po = await ProcurementService.updateStatus(
        id,
        req.body as UpdatePurchaseOrderStatusInput,
        req.user!.id,
        req.user!.roleId,
      );
      res.status(200).json(po);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bad request';
      if (message.includes('not found')) {
        res.status(404).json({ message });
        return;
      }
      if (message.includes('Cannot transition')) {
        res.status(409).json({ message });
        return;
      }
      if (message.includes('Only Managers')) {
        res.status(403).json({ message });
        return;
      }
      res.status(400).json({ message });
    }
  },
);

// ── GET /procurement/:id/history ─────────────────────────────────────────────
router.get(
  '/:id/history',
  authorize('purchase_orders:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ message: 'Invalid purchase order ID' });
        return;
      }
      const history = await ProcurementService.getHistory(id);
      res.status(200).json(history);
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

// ── POST /procurement/:id/attachments ────────────────────────────────────────
router.post(
  '/:id/attachments',
  authorize('purchase_orders:update'),
  validate(addAttachmentSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ message: 'Invalid purchase order ID' });
        return;
      }
      const attachment = await ProcurementService.addAttachment(
        id,
        req.body as AddAttachmentInput,
      );
      res.status(201).json(attachment);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bad request';
      if (message.includes('not found')) {
        res.status(404).json({ message });
        return;
      }
      res.status(400).json({ message });
    }
  },
);

// ── DELETE /procurement/:id/attachments/:attachmentId ────────────────────────
router.delete(
  '/:id/attachments/:attachmentId',
  authorize('purchase_orders:update'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const attachmentId = parseInt(req.params.attachmentId as string, 10);
      if (isNaN(id) || isNaN(attachmentId)) {
        res
          .status(400)
          .json({ message: 'Invalid purchase order or attachment ID' });
        return;
      }
      const result = await ProcurementService.deleteAttachment(
        id,
        attachmentId,
      );
      res.status(200).json(result);
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

// GET /procurement/:id/equipment
router.get(
  '/:id/equipment',
  authorize('purchase_orders:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ message: 'Invalid purchase order ID' });
        return;
      }
      const result = await ProcurementService.getEquipmentByPO(id);
      res.status(200).json(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ message });
    }
  },
);

// PUT /procurement/:id/equipment/:equipmentId
router.put(
  '/:id/equipment/:equipmentId',
  authorize('purchase_orders:update'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const equipmentId = parseInt(req.params.equipmentId as string, 10);
      if (isNaN(id) || isNaN(equipmentId)) {
        res
          .status(400)
          .json({ message: 'Invalid purchase order or equipment ID' });
        return;
      }
      const result = await ProcurementService.updateEquipmentDetails(
        id,
        equipmentId,
        req.body as {
          serialNumber?: string | null;
          location?: string | null;
          brand?: string | null;
          model?: string | null;
          condition?: ConditionStatus;
          warrantyEnd?: string | null;
        },
        req.user!.id,
      );
      res.status(200).json(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      res.status(400).json({ message });
    }
  },
);

export default router;
