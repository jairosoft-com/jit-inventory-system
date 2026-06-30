import { Router, Request, Response } from 'express';
import { InventoryService } from '../services/inventory.service.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  stockInSchema,
  stockOutSchema,
  stockAdjustmentSchema,
  listMovementsQuerySchema,
  type StockInInput,
  type StockOutInput,
  type StockAdjustmentInput,
} from '../schemas/inventory.schema.js';

const router = Router();

router.use(authenticate);

// POST /inventory/stock-in
router.post(
  '/stock-in',
  authorize('stock_in:create'),
  validate(stockInSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await InventoryService.processStockIn(
        req.body as StockInInput,
        req.user!.id,
      );

      res.status(201).json(result);
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

// POST /inventory/stock-out
router.post(
  '/stock-out',
  authorize('stock_out:create'),
  validate(stockOutSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await InventoryService.processStockOut(
        req.body as StockOutInput,
        req.user!.id,
      );

      res.status(201).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bad request';

      if (message.includes('not found')) {
        res.status(404).json({ message });
        return;
      }

      if (message.includes('Insufficient stock')) {
        res.status(422).json({ message });
        return;
      }

      res.status(400).json({ message });
    }
  },
);

// POST /inventory/adjustments
router.post(
  '/adjustments',
  authorize('adjustment:create'),
  validate(stockAdjustmentSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await InventoryService.processAdjustment(
        req.body as StockAdjustmentInput,
        req.user!.id,
      );

      res.status(201).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bad request';

      if (message.includes('not found')) {
        res.status(404).json({ message });
        return;
      }

      if (message.includes('cannot be negative')) {
        res.status(422).json({ message });
        return;
      }

      res.status(400).json({ message });
    }
  },
);

// GET /inventory/movements
router.get(
  '/movements',
  authorize('movement:read'),
  validate(listMovementsQuerySchema, 'query'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const query = listMovementsQuerySchema.parse(req.query);
      const result = await InventoryService.listMovements(query);

      res.status(200).json(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';

      res.status(500).json({ message });
    }
  },
);

// GET /inventory/:consumableProfileId/movements
router.get(
  '/:consumableProfileId/movements',
  authorize('movement:read'),
  validate(listMovementsQuerySchema, 'query'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const consumableProfileId = parseInt(
        req.params.consumableProfileId as string,
        10,
      );

      if (isNaN(consumableProfileId)) {
        res.status(400).json({ message: 'Invalid consumable profile ID' });
        return;
      }

      const query = listMovementsQuerySchema.parse(req.query);

      const result = await InventoryService.listMovements({
        ...query,
        consumableProfileId,
      });

      res.status(200).json(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';

      res.status(500).json({ message });
    }
  },
);

export default router;
