import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma.js';
import { ProcurementService } from './procurement.service.js';
import { ForbiddenError, NotFoundError } from '../lib/errors.js';

// Covers PR review finding #5 "Missing automated tests for new endpoint &
// ownership changes": the creator-only ownership check on attachment
// mutations, and the replace-attachment atomicity/concurrency fix (#3/#4)
// had no test coverage prior to this file.
describe('ProcurementService attachments (creator-only ownership)', () => {
  const creatorEmail = 'po-owner-test@example.com';
  const otherEmail = 'po-non-owner-test@example.com';

  let roleId: number;
  let creatorId: number;
  let otherUserId: number;
  let supplierId: number;
  let itemId: number;
  let categoryId: number;
  let poId: number;
  let attachmentId: number;

  const samplePdf =
    'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrp/Og0MTGCg==';

  beforeAll(async () => {
    let role = await prisma.role.findFirst({ where: { name: 'STAFF' } });
    if (!role) {
      role = await prisma.role.create({
        data: { name: 'STAFF', description: 'Staff Role' },
      });
    }
    roleId = role.id;

    await prisma.user.deleteMany({
      where: { email: { in: [creatorEmail, otherEmail] } },
    });

    const hashedPassword = await bcrypt.hash('Password123!', 10);
    const creator = await prisma.user.create({
      data: {
        firstName: 'PO',
        lastName: 'Owner',
        email: creatorEmail,
        password: hashedPassword,
        roleId,
        isActive: true,
      },
    });
    creatorId = creator.id;

    const other = await prisma.user.create({
      data: {
        firstName: 'PO',
        lastName: 'NonOwner',
        email: otherEmail,
        password: hashedPassword,
        roleId,
        isActive: true,
      },
    });
    otherUserId = other.id;

    const category = await prisma.category.create({
      data: {
        name: `procurement-test-category-${Date.now()}`,
        type: 'CONSUMABLE',
      },
    });
    categoryId = category.id;

    const supplier = await prisma.supplier.create({
      data: {
        supplierName: 'Procurement Test Supplier',
        contactPerson: 'Jane Doe',
        email: 'supplier@example.com',
      },
    });
    supplierId = supplier.id;

    const item = await prisma.item.create({
      data: {
        itemName: 'Procurement Test Item',
        categoryId,
        itemType: 'CONSUMABLE',
      },
    });
    itemId = item.id;
  });

  afterAll(async () => {
    if (poId) {
      await prisma.purchaseOrderAttachment
        .deleteMany({ where: { purchaseOrderId: poId } })
        .catch(() => undefined);
      await prisma.purchaseOrderHistory
        .deleteMany({ where: { purchaseOrderId: poId } })
        .catch(() => undefined);
      await prisma.purchaseOrder
        .delete({ where: { id: poId } })
        .catch(() => undefined);
    }
    await prisma.item.delete({ where: { id: itemId } }).catch(() => undefined);
    await prisma.supplier
      .delete({ where: { id: supplierId } })
      .catch(() => undefined);
    await prisma.category
      .delete({ where: { id: categoryId } })
      .catch(() => undefined);
    await prisma.user
      .deleteMany({ where: { id: { in: [creatorId, otherUserId] } } })
      .catch(() => undefined);
  });

  it('creates a purchase order owned by the creator', async () => {
    const po = await ProcurementService.create(
      {
        supplierId,
        invoiceNumber: null,
        lineItems: [{ itemId, quantity: 2, unitCost: 10 }],
      },
      creatorId,
    );
    expect(po).not.toBeNull();
    poId = po!.id;
    expect(po!.createdById).toBe(creatorId);
  });

  it('lets the creator add an attachment', async () => {
    const attachment = await ProcurementService.addAttachment(
      poId,
      { fileUrl: samplePdf, fileName: 'invoice.pdf' },
      creatorId,
      'STAFF',
    );
    attachmentId = attachment.id;
    expect(attachment.fileName).toBe('invoice.pdf');
    expect(attachment.purchaseOrderId).toBe(poId);
  });

  it('throws a typed ForbiddenError when a non-creator tries to add an attachment', async () => {
    await expect(
      ProcurementService.addAttachment(
        poId,
        { fileUrl: samplePdf, fileName: 'sneaky.pdf' },
        otherUserId,
        'STAFF',
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('throws a typed ForbiddenError when a non-creator tries to replace an attachment', async () => {
    await expect(
      ProcurementService.replaceAttachment(
        poId,
        attachmentId,
        { fileUrl: samplePdf, fileName: 'replacement.pdf' },
        otherUserId,
        'STAFF',
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('throws a typed ForbiddenError when a non-creator tries to delete an attachment', async () => {
    await expect(
      ProcurementService.deleteAttachment(
        poId,
        attachmentId,
        otherUserId,
        'STAFF',
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('replaceAttachment preserves the attachment id (no delete+create)', async () => {
    const updated = await ProcurementService.replaceAttachment(
      poId,
      attachmentId,
      { fileUrl: samplePdf, fileName: 'invoice-v2.pdf' },
      creatorId,
      'STAFF',
    );
    expect(updated.id).toBe(attachmentId);
    expect(updated.fileName).toBe('invoice-v2.pdf');
  });

  it('throws NotFoundError when replacing an attachment that does not belong to the PO', async () => {
    await expect(
      ProcurementService.replaceAttachment(
        poId,
        999999,
        { fileUrl: samplePdf, fileName: 'ghost.pdf' },
        creatorId,
        'STAFF',
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('handles concurrent replace requests without losing an update or duplicating rows', async () => {
    const [resultA, resultB] = await Promise.all([
      ProcurementService.replaceAttachment(
        poId,
        attachmentId,
        { fileUrl: samplePdf, fileName: 'concurrent-a.pdf' },
        creatorId,
        'STAFF',
      ),
      ProcurementService.replaceAttachment(
        poId,
        attachmentId,
        { fileUrl: samplePdf, fileName: 'concurrent-b.pdf' },
        creatorId,
        'STAFF',
      ),
    ]);

    // Both requests should resolve against the same row id — no orphaned
    // duplicate attachment created by a delete+create race.
    expect(resultA.id).toBe(attachmentId);
    expect(resultB.id).toBe(attachmentId);

    const attachmentsOnPo = await prisma.purchaseOrderAttachment.findMany({
      where: { purchaseOrderId: poId },
    });
    expect(attachmentsOnPo).toHaveLength(1);
    // The last write wins; fileName is one of the two concurrent values,
    // never a third/garbled value.
    expect(['concurrent-a.pdf', 'concurrent-b.pdf']).toContain(
      attachmentsOnPo[0].fileName,
    );
  });

  it('a STAFF user cannot find (and therefore cannot act on) a PO created by someone else', async () => {
    await expect(
      ProcurementService.findOne(poId, otherUserId, 'STAFF'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});