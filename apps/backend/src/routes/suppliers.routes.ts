import { Router, Request, Response } from 'express';
import { SuppliersService } from '../services/suppliers.service.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  createSupplierSchema,
  updateSupplierSchema,
  listSuppliersQuerySchema,
  CreateSupplierInput,
  UpdateSupplierInput,
  ListSuppliersQuery,
} from '../schemas/suppliers.schema.js';

const router = Router();

// All supplier routes require authentication
router.use(authenticate);

// POST /suppliers
router.post(
  '/',
  authorize('suppliers:create'),
  validate(createSupplierSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const supplier = await SuppliersService.create(
        req.body as CreateSupplierInput,
        req.user!.id,
      );
      res.status(201).json(supplier);
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

// GET /suppliers
router.get(
  '/',
  authorize('suppliers:read'),
  validate(listSuppliersQuerySchema, 'query'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const query = req.query as unknown as ListSuppliersQuery;
      const suppliers = await SuppliersService.findAll(query.includeArchived);
      res.status(200).json(suppliers);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ message });
    }
  },
);

// GET /suppliers/:id
router.get(
  '/:id',
  authorize('suppliers:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ message: 'Invalid supplier ID' });
        return;
      }
      const supplier = await SuppliersService.findOne(id);
      res.status(200).json(supplier);
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

// PUT /suppliers/:id
router.put(
  '/:id',
  authorize('suppliers:update'),
  validate(updateSupplierSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ message: 'Invalid supplier ID' });
        return;
      }
      const supplier = await SuppliersService.update(
        id,
        req.body as UpdateSupplierInput,
        req.user!.id,
      );
      res.status(200).json(supplier);
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

// PATCH /suppliers/:id/archive
router.patch(
  '/:id/archive',
  authorize('suppliers:delete'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ message: 'Invalid supplier ID' });
        return;
      }
      const supplier = await SuppliersService.archive(id, req.user!.id);
      res.status(200).json(supplier);
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

// GET /suppliers/:id/history
router.get(
  '/:id/history',
  authorize('suppliers:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ message: 'Invalid supplier ID' });
        return;
      }
      const history = await SuppliersService.getHistory(id);
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

export default router;
