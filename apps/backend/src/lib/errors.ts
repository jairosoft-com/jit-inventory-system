// Typed application errors. Route handlers should map these to HTTP
// responses via `instanceof` / `err.statusCode`, never by string-matching
// `err.message` — message text is for humans, not for control flow.

export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Request conflicts with current state') {
    super(message, 409);
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = 'Payload exceeds the maximum allowed size') {
    super(message, 413);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request') {
    super(message, 400);
  }
}