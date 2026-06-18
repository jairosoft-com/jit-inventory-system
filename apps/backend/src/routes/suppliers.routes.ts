import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { SuppliersService } from '../services/suppliers.service.js';
import { listSuppliersQuerySchema } from '../schemas/suppliers.schema.js';

const router = Router();

router.use(authenticate);

// GET /suppliers
router.get(
  '/',
  authorize('suppliers:read'),
  validate(listSuppliersQuerySchema, 'query'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const query = listSuppliersQuerySchema.parse(req.query);
      const suppliers = await SuppliersService.findAll(query);

      res.status(200).json(suppliers);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';

      res.status(500).json({ message });
    }
  },
);

export default router;
