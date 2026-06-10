import { Router, Request, Response } from 'express';
import { ItemsService } from '../services/items.service.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  createItemSchema,
  updateItemSchema,
  listItemsQuerySchema,
  itemImageSchema,
  updateItemImageSchema,
  type CreateItemInput,
  type UpdateItemInput,
  type ListItemsQuery,
  type ItemImageInput,
  type UpdateItemImageInput,
} from '../schemas/items.schema.js';


const router = Router();

router.use(authenticate);

// POST /items
router.post(
  '/',
  authorize('inventory:create'),
  validate(createItemSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const item = await ItemsService.create(
        req.body as CreateItemInput,
        req.user!.id,
      );
      res.status(201).json(item);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bad request';
      if (message.includes('not found')) {
        res.status(404).json({ message });
        return;
      }
      if (
        message.includes('already in use') ||
        message.includes('already exists')
      ) {
        res.status(409).json({ message });
        return;
      }
      if (message.includes('does not match')) {
        res.status(422).json({ message });
        return;
      }
      res.status(400).json({ message });
    }
  },
);

// GET /items
router.get(
  '/',
  authorize('inventory:read'),
  validate(listItemsQuerySchema, 'query'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await ItemsService.findAll(
        req.query as unknown as ListItemsQuery,
      );
      res.status(200).json(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ message });
    }
  },
);

// GET /items/max-barcode  — returns highest ITM-NNN number across all items (active + archived)
router.get(
  '/max-barcode',
  authorize('inventory:read'),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const max = await ItemsService.findMaxBarcode();
      res.status(200).json({ max });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ message });
    }
  },
);

// GET /items/:id
router.get(
  '/:id',
  authorize('inventory:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ message: 'Invalid item ID' });
        return;
      }
      const item = await ItemsService.findOne(id);
      res.status(200).json(item);
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

// PATCH /items/:id
router.patch(
  '/:id',
  authorize('inventory:update'),
  validate(updateItemSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ message: 'Invalid item ID' });
        return;
      }
      const item = await ItemsService.update(id, req.body as UpdateItemInput);
      res.status(200).json(item);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bad request';
      if (message.includes('not found')) {
        res.status(404).json({ message });
        return;
      }
      if (message.includes('already in use')) {
        res.status(409).json({ message });
        return;
      }
      if (message.includes('does not match')) {
        res.status(422).json({ message });
        return;
      }
      res.status(400).json({ message });
    }
  },
);

// DELETE /items/:id  (soft delete)
router.delete(
  '/:id',
  authorize('inventory:delete'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ message: 'Invalid item ID' });
        return;
      }
      const result = await ItemsService.archive(id);
      res.status(200).json(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      if (message.includes('not found')) {
        res.status(404).json({ message });
        return;
      }
      if (message.includes('must be archived via')) {
        res.status(400).json({ message });
        return;
      }
      res.status(500).json({ message });
    }
  },
);

// ── Item Images ────────────────────────────────────────────────────────────

// POST /items/:id/images
router.post(
  '/:id/images',
  authorize('inventory:update'),
  validate(itemImageSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const itemId = parseInt(req.params.id as string, 10);
      if (isNaN(itemId)) {
        res.status(400).json({ message: 'Invalid item ID' });
        return;
      }
      const image = await ItemsService.addImage(
        itemId,
        req.body as ItemImageInput,
      );
      res.status(201).json(image);
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

// PATCH /items/:id/images/:imageId
router.patch(
  '/:id/images/:imageId',
  authorize('inventory:update'),
  validate(updateItemImageSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const itemId = parseInt(req.params.id as string, 10);
      const imageId = parseInt(req.params.imageId as string, 10);
      if (isNaN(itemId) || isNaN(imageId)) {
        res.status(400).json({ message: 'Invalid item or image ID' });
        return;
      }
      const image = await ItemsService.updateImage(
        itemId,
        imageId,
        req.body as UpdateItemImageInput,
      );
      res.status(200).json(image);
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

// DELETE /items/:id/images/:imageId
router.delete(
  '/:id/images/:imageId',
  authorize('inventory:update'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const itemId = parseInt(req.params.id as string, 10);
      const imageId = parseInt(req.params.imageId as string, 10);
      if (isNaN(itemId) || isNaN(imageId)) {
        res.status(400).json({ message: 'Invalid item or image ID' });
        return;
      }
      const result = await ItemsService.deleteImage(itemId, imageId);
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

export default router;

