import { Router, Request, Response } from 'express';
import { UsersService } from '../services/users.service.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  createUserSchema,
  queryUsersSchema,
  updateUserAccessSchema,
} from '../schemas/users.schema.js';
import type {
  CreateUserInput,
  UpdateUserAccessInput,
} from '../schemas/users.schema.js';

const router = Router();

// Apply authentication to all user routes
router.use(authenticate);

// GET /users/summary
router.get(
  '/summary',
  authorize('users:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const summary = await UsersService.getSummary();
      res.status(200).json(summary);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ message });
    }
  },
);

// GET /users/roles
router.get(
  '/roles',
  authorize('roles:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const roles = await UsersService.getRoles();
      res.status(200).json(roles);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ message });
    }
  },
);

// GET /users
router.get(
  '/',
  authorize('users:read'),
  validate(queryUsersSchema, 'query'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await UsersService.findAll(req.query);
      res.status(200).json(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ message });
    }
  },
);

// GET /users/:id
router.get(
  '/:id',
  authorize('users:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ message: 'Invalid user ID' });
        return;
      }
      const user = await UsersService.findOne(id);
      res.status(200).json(user);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      if (message === 'User not found') {
        res.status(404).json({ message });
        return;
      }
      res.status(500).json({ message });
    }
  },
);

// POST /users
router.post(
  '/',
  authorize('users:manage'),
  validate(createUserSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const newUser = await UsersService.create(req.body as CreateUserInput);
      res.status(201).json(newUser);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      if (
        message === 'Email is already in use' ||
        message === 'Role not found'
      ) {
        res.status(400).json({ message });
        return;
      }
      res.status(500).json({ message });
    }
  },
);

// PATCH /users/:id/access
router.patch(
  '/:id/access',
  authorize('users:manage'),
  validate(updateUserAccessSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ message: 'Invalid user ID' });
        return;
      }
      const currentUserId = req.user?.id;
      const updatedUser = await UsersService.updateAccess(
        id,
        req.body as UpdateUserAccessInput,
        currentUserId,
      );
      res.status(200).json(updatedUser);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : 'Internal server error';
      if (msg === 'User not found' || msg === 'Role not found') {
        res.status(404).json({ message: msg });
        return;
      }
      if (
        msg.includes('deactivate your own account') ||
        msg.includes('change your own role') ||
        msg.includes('Provide at least one field')
      ) {
        res.status(400).json({ message: msg });
        return;
      }
      res.status(500).json({ message: msg });
    }
  },
);

export default router;
