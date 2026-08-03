import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors.js';

// Must be registered LAST, after all routers. Express recognizes it as an
// error handler by its 4-argument signature.
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  if (res.headersSent) return;

  // body-parser / raw-body throws this when Content-Length or the streamed
  // body exceeds the configured `limit` — previously fell through to
  // Express's default handler (HTML response, inconsistent status).
  if (
    err &&
    typeof err === 'object' &&
    ('type' in err || 'status' in err) &&
    ((err as { type?: string }).type === 'entity.too.large' ||
      (err as { status?: number }).status === 413)
  ) {
    res.status(413).json({
      message: 'Payload exceeds the maximum allowed size',
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ message: err.message });
    return;
  }

  // eslint-disable-next-line no-console
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error' });
}