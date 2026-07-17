import { z } from 'zod';

// ── Create Purchase Order ────────────────────────────────────────────────────
export const createPurchaseOrderSchema = z.object({
  supplierId: z.number().int().positive('Supplier ID is required'),
  invoiceNumber: z
    .string()
    .trim()
    .max(100)
    .nullable()
    .optional()
    .or(z.literal('')),
  lineItems: z
    .array(
      z.object({
        itemId: z.number().int().positive('Item ID is required'),
        quantity: z.number().int().positive('Quantity must be at least 1'),
        unitCost: z.number().positive('Unit cost must be greater than 0'),
      }),
    )
    .min(1, 'At least one line item is required'),
});

// ── Update Purchase Order (Draft only) ───────────────────────────────────────
export const updatePurchaseOrderSchema = z.object({
  supplierId: z.number().int().positive().optional(),
  invoiceNumber: z
    .string()
    .trim()
    .max(100)
    .nullable()
    .optional()
    .or(z.literal('')),
  lineItems: z
    .array(
      z.object({
        itemId: z.number().int().positive('Item ID is required'),
        quantity: z.number().int().positive('Quantity must be at least 1'),
        unitCost: z.number().positive('Unit cost must be greater than 0'),
      }),
    )
    .min(1, 'At least one line item is required')
    .optional(),
});

// ── Update PO Status ─────────────────────────────────────────────────────────
export const updatePurchaseOrderStatusSchema = z.object({
  status: z.enum([
    'PENDING',
    'APPROVED',
    'REJECTED',
    'COMPLETED',
    'CANCELLED',
    'ARCHIVED',
  ]),
  notes: z.string().trim().max(500).optional(),
});

// ── List Query ───────────────────────────────────────────────────────────────
export const listPurchaseOrdersQuerySchema = z.object({
  status: z
    .enum([
      'DRAFT',
      'PENDING',
      'APPROVED',
      'REJECTED',
      'COMPLETED',
      'CANCELLED',
      'ARCHIVED',
    ])
    .optional(),
  includeArchived: z
    .preprocess((val) => {
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return undefined;
    }, z.boolean().optional())
    .default(false),
});

// ── Attachment ───────────────────────────────────────────────────────────────
const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

// Parses `data:<mime>[;charset=..][;base64],<payload>` and returns the
// canonical MIME type (stripped of charset/vendor parameters) plus the
// decoded byte length. Returns null if the value isn't a well-formed data URL.
function parseDataUrl(
  val: string,
): { mime: string; byteLength: number } | null {
  const match = /^data:([^;,]+)(;[^,]*)?,(.*)$/s.exec(val);
  if (!match) return null;
  const mime = match[1]?.trim().toLowerCase() ?? '';
  const params = match[2] ?? '';
  const payload = match[3] ?? '';
  if (!params.includes(';base64')) return null; // only base64 data URLs supported
  // Decoded byte length from base64 length, accounting for '=' padding.
  const padding = (payload.match(/=+$/)?.[0] ?? '').length;
  const byteLength = Math.max(
    0,
    Math.round((payload.length * 3) / 4) - padding,
  );
  return { mime, byteLength };
}

export const addAttachmentSchema = z
  .object({
    fileUrl: z
      .string()
      .trim()
      .min(1, 'File URL is required')
      .refine(
        (val) => {
          const parsed = parseDataUrl(val);
          if (parsed) return ALLOWED_ATTACHMENT_MIME_TYPES.has(parsed.mime);
          // Non data-URL values (e.g. real storage URLs) fall back to extension check.
          return /\.(pdf|doc|docx)$/i.test(val);
        },
        {
          message:
            'Unsupported file type. Only PDF, DOC, and DOCX files are allowed.',
        },
      )
      .refine(
        (val) => {
          const parsed = parseDataUrl(val);
          if (!parsed) return true; // non data-URL values have no client-side size to check
          return parsed.byteLength <= MAX_ATTACHMENT_BYTES;
        },
        { message: 'Your file exceeds the 10MB limit.' },
      ),
    fileName: z.string().trim().min(1, 'File name is required').max(255),
    fileSize: z
      .number()
      .int()
      .positive()
      .optional()
      .refine((val) => !val || val <= MAX_ATTACHMENT_BYTES, {
        message: 'Your file exceeds the 10MB limit.',
      }),
  })
  .refine(
    (data) => {
      const parsed = parseDataUrl(data.fileUrl);
      if (!parsed || data.fileSize === undefined) return true;
      // Allow a small tolerance for base64 padding/rounding rather than exact equality.
      const tolerance = 8;
      return Math.abs(parsed.byteLength - data.fileSize) <= tolerance;
    },
    {
      message: 'Declared file size does not match the uploaded file.',
      path: ['fileSize'],
    },
  );

// ── Export types ─────────────────────────────────────────────────────────────
export type CreatePurchaseOrderInput = z.infer<
  typeof createPurchaseOrderSchema
>;
export type UpdatePurchaseOrderInput = z.infer<
  typeof updatePurchaseOrderSchema
>;
export type UpdatePurchaseOrderStatusInput = z.infer<
  typeof updatePurchaseOrderStatusSchema
>;
export type ListPurchaseOrdersQuery = z.infer<
  typeof listPurchaseOrdersQuerySchema
>;
export type AddAttachmentInput = z.infer<typeof addAttachmentSchema>;