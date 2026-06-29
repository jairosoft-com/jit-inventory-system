import { Router, Request, Response } from 'express';
import { EquipmentService } from '../services/equipment.service.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { prisma } from '../lib/prisma.js';
import {
  createEquipmentSchema,
  updateEquipmentSchema,
  listEquipmentQuerySchema,
  retiredEquipmentArchiveQuerySchema,
  equipmentImageSchema,
  updateImageSchema,
  retirementRequestSchema,
  type CreateEquipmentInput,
  type UpdateEquipmentInput,
  type EquipmentImageInput,
  type UpdateImageInput,
  type ListEquipmentQuery,
  type RetiredEquipmentArchiveQuery,
  type RetirementRequestInput,
} from '../schemas/equipment.schema.js';

const router = Router();

// All equipment routes require authentication
router.use(authenticate);

// ── Equipment CRUD ────────────────────────────────────────────────────────────

// POST /equipment
router.post(
  '/',
  authorize('equipment:create'),
  validate(createEquipmentSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const equipment = await EquipmentService.create(
        req.body as CreateEquipmentInput,
        req.user!.id,
      );

      res.status(201).json(equipment);
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

      if (message.includes('must be of type')) {
        res.status(422).json({ message });
        return;
      }

      res.status(400).json({ message });
    }
  },
);

// GET /equipment
router.get(
  '/',
  authorize('equipment:read'),
  validate(listEquipmentQuerySchema, 'query'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await EquipmentService.findAll(
        req.query as unknown as ListEquipmentQuery,
      );

      res.status(200).json(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';

      res.status(500).json({ message });
    }
  },
);

// GET /equipment/disposal-history
router.get(
  '/disposal-history',
  authorize('equipment:read'),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const history = await EquipmentService.getDisposalHistory();

      res.status(200).json(history);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';

      res.status(500).json({ message });
    }
  },
);

// GET /equipment/retired-archive
router.get(
  '/retired-archive',
  authorize('equipment:read'),
  validate(retiredEquipmentArchiveQuerySchema, 'query'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const archive = await EquipmentService.getRetiredEquipmentArchive(
        req.query as unknown as RetiredEquipmentArchiveQuery,
      );

      res.status(200).json(archive);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';

      res.status(500).json({ message });
    }
  },
);

// GET /equipment/:id
router.get(
  '/:id',
  authorize('equipment:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);

      if (isNaN(id)) {
        res.status(400).json({ message: 'Invalid equipment ID' });
        return;
      }

      const equipment = await EquipmentService.findOne(id);

      res.status(200).json(equipment);
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

// POST /equipment/:id/retirement-request
router.post(
  '/:id/retirement-request',
  authorize('equipment:update'),
  validate(retirementRequestSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);

      if (isNaN(id)) {
        res.status(400).json({ message: 'Invalid equipment ID' });
        return;
      }

      const result = await EquipmentService.submitRetirementRequest(
        id,
        req.body as RetirementRequestInput,
        req.user!.id,
      );

      res.status(201).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bad request';

      if (message.includes('not found')) {
        res.status(404).json({ message });
        return;
      }

      if (
        message.includes('borrowed') ||
        message.includes('already') ||
        message.includes('cannot be retired') ||
        message.includes('disposal record')
      ) {
        res.status(409).json({ message });
        return;
      }

      res.status(400).json({ message });
    }
  },
);

// PATCH /equipment/:id
router.patch(
  '/:id',
  authorize('equipment:update'),
  validate(updateEquipmentSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);

      if (isNaN(id)) {
        res.status(400).json({ message: 'Invalid equipment ID' });
        return;
      }
      const body = req.body as UpdateEquipmentInput;

      // If attempting to update assetId, verify that the user is an ADMIN
      if (body.assetId !== undefined) {
        const equipment = await prisma.equipment.findUnique({
          where: { id },
        });
        if (equipment && body.assetId !== equipment.assetId) {
          const user = req.user!;
          const role = await prisma.role.findUnique({
            where: { id: user.roleId },
          });
          if (role?.name !== 'ADMIN') {
            res.status(403).json({
              message:
                'Forbidden: Only administrators can modify the Asset ID.',
            });
            return;
          }
        }
      }

      const equipment = await EquipmentService.update(id, body, req.user!.id);
      res.status(200).json(equipment);
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

      if (message.includes('must be of type')) {
        res.status(422).json({ message });
        return;
      }

      res.status(400).json({ message });
    }
  },
);

// DELETE /equipment/:id  (soft delete)
router.delete(
  '/:id',
  authorize('equipment:delete'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);

      if (isNaN(id)) {
        res.status(400).json({ message: 'Invalid equipment ID' });
        return;
      }
      const result = await EquipmentService.softDelete(id, req.user!.id);
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

// ── Equipment Images ──────────────────────────────────────────────────────────

// POST /equipment/:id/images
router.post(
  '/:id/images',
  authorize('equipment:update'),
  validate(equipmentImageSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const equipmentId = parseInt(req.params.id as string, 10);

      if (isNaN(equipmentId)) {
        res.status(400).json({ message: 'Invalid equipment ID' });
        return;
      }

      const image = await EquipmentService.addImage(
        equipmentId,
        req.body as EquipmentImageInput,
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

// PATCH /equipment/:id/images/:imageId
router.patch(
  '/:id/images/:imageId',
  authorize('equipment:update'),
  validate(updateImageSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const equipmentId = parseInt(req.params.id as string, 10);
      const imageId = parseInt(req.params.imageId as string, 10);

      if (isNaN(equipmentId) || isNaN(imageId)) {
        res.status(400).json({ message: 'Invalid equipment or image ID' });
        return;
      }

      const image = await EquipmentService.updateImage(
        equipmentId,
        imageId,
        req.body as UpdateImageInput,
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

// DELETE /equipment/:id/images/:imageId
router.delete(
  '/:id/images/:imageId',
  authorize('equipment:update'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const equipmentId = parseInt(req.params.id as string, 10);
      const imageId = parseInt(req.params.imageId as string, 10);

      if (isNaN(equipmentId) || isNaN(imageId)) {
        res.status(400).json({ message: 'Invalid equipment or image ID' });
        return;
      }

      const result = await EquipmentService.deleteImage(equipmentId, imageId);

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
