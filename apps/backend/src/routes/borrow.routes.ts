import { Router, Request, Response } from 'express';
import { BorrowService } from '../services/borrow.service.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';
import { ConditionStatus } from '@prisma/client';
import {
  createBorrowSchema,
  listBorrowQuerySchema,
  rejectBorrowSchema,
  type CreateBorrowInput,
  type ListBorrowQuery,
  type RejectBorrowInput,
} from '../schemas/borrow.schema.js';

const router = Router();

// All borrow routes require authentication
router.use(authenticate);

/**
 * Determines whether the requesting user is allowed to view borrow records
 * belonging to other people. `borrow:approve` is used as the signal here —
 * it's already restricted to MANAGER/ADMIN in the seed, and anyone who can
 * approve/reject other people's requests reasonably needs to see them too.
 * STAFF holds borrow:read (so they can list/filter their own history) but
 * not borrow:approve, so this returns false for them.
 */
async function canViewAllBorrowRecords(
  roleId: number | undefined,
): Promise<boolean> {
  if (!roleId) return false;
  const grant = await prisma.rolePermission.findFirst({
    where: { roleId, permission: { name: 'borrow:approve' } },
  });
  return grant !== null;
}

// ── POST /borrow ──────────────────────────────────────────────────────────────
// Submit a new borrow request. Any authenticated user with borrow:submit can do this.

router.post(
  '/',
  authorize('borrow:submit'),
  validate(createBorrowSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const record = await BorrowService.create(
        req.body as CreateBorrowInput,
        req.user!.id,
      );
      res.status(201).json(record);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bad request';
      if (message.includes('not found')) {
        res.status(404).json({ message });
        return;
      }
      if (message.includes('unavailable')) {
        // 409 Conflict — the resource exists but cannot be borrowed right now
        res.status(409).json({ message });
        return;
      }
      res.status(400).json({ message });
    }
  },
);

// ── GET /borrow ───────────────────────────────────────────────────────────────
// List borrow records. Powers both the personal "My Requests" view and the
// org-wide "Borrow History" / "All Requests" views from the same endpoint.
//
// Scoping is enforced here, not just in the UI: a user without
// borrow:approve (i.e. STAFF) is always limited to their own records, even
// if they explicitly omit `mine` or set it to false on the request. Only
// users who can act on other people's requests (MANAGER/ADMIN) can list
// everyone's records. This prevents a STAFF user from reading colleagues'
// borrow history by simply not passing ?mine=true.

router.get(
  '/',
  authorize('borrow:read'),
  validate(listBorrowQuerySchema, 'query'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const query = req.query as unknown as ListBorrowQuery;
      const canViewAll = await canViewAllBorrowRecords(req.user!.roleId);

      const result = await BorrowService.findAll(
        canViewAll ? query : { ...query, mine: true },
        req.user!.id,
      );
      res.status(200).json(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ message });
    }
  },
);

// ── GET /borrow/:id ───────────────────────────────────────────────────────────
// Same scoping rule as the list endpoint: a STAFF user can only fetch their
// own record by id, even though the id itself is just a sequential integer.

router.get(
  '/:id',
  authorize('borrow:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ message: 'Invalid borrow record ID' });
        return;
      }
      const record = await BorrowService.findOne(id);

      const canViewAll = await canViewAllBorrowRecords(req.user!.roleId);
      if (!canViewAll && record.borrowedById !== req.user!.id) {
        // Mirror the list endpoint's not-found-style boundary rather than a
        // 403 — this avoids confirming to a STAFF user that a record with
        // this id exists at all but belongs to someone else.
        res.status(404).json({ message: 'Borrow record not found' });
        return;
      }

      res.status(200).json(record);
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

// ── PATCH /borrow/:id/approve ─────────────────────────────────────────────────
// Approve a PENDING request. Requires borrow:approve (MANAGER/ADMIN only —
// STAFF does not hold this permission, so authorize() denies with 403).

router.patch(
  '/:id/approve',
  authorize('borrow:approve'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ message: 'Invalid borrow record ID' });
        return;
      }
      const record = await BorrowService.approve(id, req.user!.id);
      res.status(200).json(record);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      // Check this first: 'Borrow record not found or no longer PENDING'
      // contains the substring 'not found', so it must be matched before
      // the plain not-found branch below or it would incorrectly 404.
      if (
        message.includes('no longer PENDING') ||
        message.includes('unavailable')
      ) {
        // 409 Conflict — request/equipment is in a state that doesn't allow this action
        res.status(409).json({ message });
        return;
      }
      if (message.includes('not found')) {
        res.status(404).json({ message });
        return;
      }
      res.status(500).json({ message });
    }
  },
);

// ── PATCH /borrow/:id/reject ───────────────────────────────────────────────────
// Reject a PENDING request. Equipment status is left untouched — it was
// never reserved. Requires borrow:approve (same gate as approval).

router.patch(
  '/:id/reject',
  authorize('borrow:approve'),
  validate(rejectBorrowSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ message: 'Invalid borrow record ID' });
        return;
      }
      const record = await BorrowService.reject(
        id,
        req.user!.id,
        req.body as RejectBorrowInput,
      );
      res.status(200).json(record);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      // Check this first: see comment in the approve handler above.
      if (message.includes('no longer PENDING')) {
        res.status(409).json({ message });
        return;
      }
      if (message.includes('not found')) {
        res.status(404).json({ message });
        return;
      }
      res.status(500).json({ message });
    }
  },
);

// ── PATCH /borrow/:id/return ──────────────────────────────────────────────────
// Marks a APPROVED/BORROWED/OVERDUE record as returned.
// Requires borrow:approve (MANAGER/ADMIN only).

const returnBorrowSchema = z.object({
  returnCondition: z.nativeEnum(ConditionStatus),
});

router.patch(
  '/:id/return',
  authorize('borrow:approve'),
  validate(returnBorrowSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ message: 'Invalid borrow record ID' });
        return;
      }

      const { returnCondition } = req.body as z.infer<typeof returnBorrowSchema>;
      const record = await BorrowService.return(id, returnCondition);
      res.status(200).json(record);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      if (message.includes('cannot be returned')) {
        res.status(409).json({ message });
        return;
      }
      if (message.includes('not found')) {
        res.status(404).json({ message });
        return;
      }
      res.status(500).json({ message });
    }
  },
);

export default router;
