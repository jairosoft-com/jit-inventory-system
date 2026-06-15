import { Router, Request, Response } from 'express';
import { CategoriesService } from '../services/categories.service.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  createCategorySchema,
  updateCategorySchema,
  CreateCategoryInput,
  UpdateCategoryInput,
  listCategoriesQuerySchema,
  ListCategoriesQuery,
} from '../schemas/categories.schema.js';

const router = Router();

// All category routes require authentication
router.use(authenticate);

// POST /categories
router.post(
  '/',
  authorize('categories:create'),
  validate(createCategorySchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const category = await CategoriesService.create(
        req.body as CreateCategoryInput,
      );
      res.status(201).json(category);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bad request';
      if (message.includes('already exists')) {
        res.status(409).json({ message });
        return;
      }
      res.status(400).json({ message });
    }
  },
);

// GET /categories
router.get(
  '/',
  authorize('categories:read'),
  validate(listCategoriesQuerySchema, 'query'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const query = req.query as unknown as ListCategoriesQuery;
      const categories = await CategoriesService.findAll(query);
      res.status(200).json(categories);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ message });
    }
  },
);

// GET /categories/:id
router.get(
  '/:id',
  authorize('categories:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ message: 'Invalid category ID' });
        return;
      }
      const category = await CategoriesService.findOne(id);
      res.status(200).json(category);
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

// PATCH /categories/:id
router.patch(
  '/:id',
  authorize('categories:update'),
  validate(updateCategorySchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ message: 'Invalid category ID' });
        return;
      }
      const category = await CategoriesService.update(
        id,
        req.body as UpdateCategoryInput,
      );
      res.status(200).json(category);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bad request';
      if (message.includes('not found')) {
        res.status(404).json({ message });
        return;
      }
      if (message.includes('already exists')) {
        res.status(409).json({ message });
        return;
      }
      res.status(400).json({ message });
    }
  },
);

// DELETE /categories/:id
router.delete(
  '/:id',
  authorize('categories:delete'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ message: 'Invalid category ID' });
        return;
      }
      const result = await CategoriesService.archive(id);
      res.status(200).json(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      if (message.includes('not found')) {
        res.status(404).json({ message });
        return;
      }
      if (message.includes('Cannot archive')) {
        res.status(400).json({ message });
        return;
      }
      res.status(500).json({ message });
    }
  },
);

export default router;
